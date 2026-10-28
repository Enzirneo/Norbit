# 07 — Autenticação

Implementada na Fase 1. Este documento registra **por que** cada peça é como é, e o
que foi verificado contra o sistema rodando em vez de presumido.

O código está em `apps/api/src/app/auth/`, a regra de rotação em
`libs/domain/src/lib/auth/`, e os schemas de entrada em `libs/contracts`.

## Os dois tokens, e por que são de naturezas diferentes

|             | Access token                          | Refresh token                          |
| ----------- | ------------------------------------- | -------------------------------------- |
| Formato     | JWT assinado                          | string opaca, 256 bits aleatórios      |
| Prazo       | 15 minutos                            | 30 dias                                |
| Onde vive   | memória do cliente, corpo da resposta | cookie `httpOnly`, caminho `/api/auth` |
| No banco    | nada                                  | só o hash SHA-256                      |
| Verificação | assinatura, sem consultar o banco     | consulta obrigatória                   |
| Revogável   | **não**                               | sim                                    |

A assimetria é o ponto. O access token não consulta o banco, e é isso que torna cada
requisição barata; o preço é não poder ser revogado, e é por isso que dura 15 minutos.
O refresh é o oposto: cada uso passa pelo banco, então pode ser derrubado na hora.

Um JWT de 30 dias juntaria o pior dos dois: a duração do refresh com a
irrevogabilidade do access. É o erro mais comum nesta parte.

### Por que SHA-256 no refresh, e Argon2id só na senha

Parece inconsistente usar hashing forte para senha e hashing simples para token. Não é,
e as razões são duas.

A primeira é funcional: a sessão é buscada **pelo** hash. Ele precisa ser
determinístico, e o Argon2 usa salt aleatório — procurar por ele obrigaria a varrer
todas as sessões do banco a cada renovação.

A segunda é que Argon2 existe para compensar a baixa entropia de senhas humanas.
`senha123` precisa que cada tentativa custe caro. Um valor de 256 bits aleatórios não
tem esse problema: não existe dicionário que o alcance, e o custo de memória seria
desperdício de CPU em cada renovação.

## A detecção de reúso

Cada refresh é de uso único. Ao ser usado, é revogado e um novo toma o seu lugar na
mesma **família** — o `familyId` que agrupa todos os tokens originados de um mesmo
login.

Então um token já revogado reaparecendo significa que existe uma cópia dele em
circulação. E a resposta correta não é recusar só aquela requisição: é **revogar a
família inteira**, porque não há como saber se o legítimo é quem acabou de chegar ou
quem rotacionou antes.

> Falso positivo custa um login. Falso negativo custa a conta.

A decisão é função pura em `libs/domain`, não método de serviço, por um motivo
prático: é a regra mais fácil de escrever errado em toda a autenticação e a mais
difícil de perceber que está errada — um bug aqui não quebra o login, só deixa de
detectar o roubo. Como função pura, cada caso é exercitado em milissegundos, sem subir
banco.

```ts
avaliarRotacao(sessao, agora);
//  null              → 'desconhecida'     recusa, sem consequência
//  revokedAt != null → 'reuso-detectado'  recusa + revoga a família
//  expiresAt <= agora→ 'expirada'         recusa, sem revogar
//  caso contrário    → 'rotacionar'       emite o próximo par
```

Duas decisões de ordem que não são óbvias:

1. **Reúso vem antes de expiração.** Uma sessão revogada _e_ expirada que reaparece
   continua sendo sinal de cópia indevida; tratá-la apenas como expirada jogaria a
   detecção fora.
2. **Expirar não revoga.** Vencer é normal, não é ataque. Marcar como revogada
   confundiria o diagnóstico depois.

### Sair revoga a família, não só o token atual

Revogar apenas o token corrente deixaria vivo qualquer outro já rotacionado a partir
do mesmo login. Revogar a família também torna a detecção idempotente: um token antigo
reaparecendo depois da saída encontra a família já revogada, e revogá-la de novo é
inócuo — o que evita tratar um logout legítimo como incidente.

## O que impede enumerar contas

Três detalhes que custam pouco e fecham oráculos conhecidos:

| Detalhe                                                  | O que vazaria sem ele                    |
| -------------------------------------------------------- | ---------------------------------------- |
| Mensagem idêntica para e-mail inexistente e senha errada | quais e-mails têm conta                  |
| `verificarEmTempoConstante` quando o e-mail não existe   | o mesmo, pelo tempo de resposta          |
| Login sem mínimo de senha                                | que aquela senha não satisfaz a política |

O segundo exige cuidado: o hash de fachada precisa ser **válido**. Um valor inventado
faz o `verify` lançar de imediato, a verificação custa quase nada, e o oráculo de tempo
continua aberto. Por isso ele é calculado na subida, a partir de bytes aleatórios.

## Política de senha: comprimento, não composição

Doze caracteres no mínimo, e nenhuma exigência de maiúscula, número ou símbolo.

Regra de composição produz `Senha@123`: curta, previsível e aprovada por qualquer
regex. Comprimento é o único critério que correlaciona com dificuldade real de quebra,
e é o que o NIST recomenda desde a SP 800-63B. Há um teto de 200 caracteres porque o
Argon2id gasta CPU proporcional à entrada — sem limite, um corpo de 1 MB seria negação
de serviço barata.

## Argon2id: parâmetros e escolha de pacote

19 MiB de memória, 2 iterações, paralelismo 1 — o mínimo que a OWASP recomenda. É o
custo de **memória** que torna o ataque com GPU caro, e é por isso que bcrypt, de
memória fixa e pequena, não é escolha para código novo.

O pacote é `@node-rs/argon2`, não `argon2`: o segundo exige `node-gyp` e compilação
nativa, que no Windows é fonte garantida de problema. O primeiro traz binário pronto.

## Configuração recusada na subida

Duas verificações que falham ao iniciar, não na primeira requisição:

- **`JWT_ACCESS_SECRET` igual ao valor de exemplo em produção.** Um JWT assinado com
  `troque-isto` é um JWT que qualquer pessoa forja: basta ler o `.env.example`, e o
  repositório é público. Em desenvolvimento o valor passa, porque trocá-lo a cada
  clone só atrapalha.
- **`JWT_ACCESS_TTL` com formato inválido.** Um `15min` (unidade errada) faria o
  `jsonwebtoken` lançar somente no primeiro login, em produção, parecendo falha de
  autenticação.

## Rotas

| Método | Rota                 | Protegida | Resposta                      |
| ------ | -------------------- | --------- | ----------------------------- |
| `POST` | `/api/auth/cadastro` | não       | `201` + access token + cookie |
| `POST` | `/api/auth/login`    | não       | `200` + access token + cookie |
| `POST` | `/api/auth/refresh`  | cookie    | `200` + par novo              |
| `POST` | `/api/auth/logout`   | cookie    | `204`                         |
| `GET`  | `/api/auth/eu`       | Bearer    | `200` + perfil                |

`/eu` reconsulta o banco e devolve `401` se a conta não existir mais: o access token
vale 15 minutos sem consultar nada, então a conta pode ter sido apagada no intervalo.

## O que foi verificado rodando

Não presumido — executado contra a API de pé e o Postgres do `docker compose`.

| Passo                                    | Resultado                                                       |
| ---------------------------------------- | --------------------------------------------------------------- |
| Cadastro                                 | `201`, cookie `httpOnly` com path `/api/auth`, `sub` em UUID v7 |
| `GET /eu` com Bearer válido              | `200`                                                           |
| `GET /eu` sem token                      | `401`                                                           |
| `GET /eu` com token adulterado (um byte) | `401`                                                           |
| Refresh legítimo                         | `200`, token novo diferente do anterior                         |
| **Replay do refresh antigo**             | `401` + `WARN ... família ... revogada`                         |
| **Sessão legítima depois do replay**     | `401` — a família caiu junto                                    |
| Sessões no banco, depois do incidente    | 2 linhas, 2 revogadas                                           |
| Login correto                            | `200`                                                           |
| Senha errada / e-mail inexistente        | `401`, **mensagens idênticas**                                  |
| Cadastro inválido                        | `400` com uma mensagem por campo                                |
| Logout                                   | `204`; refresh seguinte `401`                                   |

Mais 15 testes automatizados em `apps/api` (integração, banco real) e 6 na regra pura
de `libs/domain`.

## O que ainda falta da Fase 1

- Interceptor no Angular que renova o access token de forma transparente
- Telas de cadastro e login, com guard de rota e redirecionamento
- Perfil: nome de exibição, handle, avatar, fuso horário
- Recuperação de senha por e-mail (Mailpit já está no `docker-compose`)
- Listar e encerrar sessões ativas (o `userAgent` e o `ipAddress` já são gravados para
  isso)

## Decisão deixada em aberto, de propósito

O `SameSite` do cookie é `strict`, o que basta enquanto web e api estiverem no mesmo
site — porta não conta para o `SameSite`, e em produção serão subdomínios do mesmo
domínio. Se a API algum dia mudar de domínio, isto vira `none` com `secure`
obrigatório, e aí o CORS deixa de ser detalhe de configuração para virar parte do
desenho.

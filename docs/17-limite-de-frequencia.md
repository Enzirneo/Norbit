# 17 — Limite de frequência

Fecha o risco que o [PR de recuperação de senha](15-recuperacao-de-senha.md) deixou registrado:
nada impedia pedir o link mil vezes para o e-mail de uma vítima, ou martelar o login até
acertar uma senha.

```
libs/domain/src/lib/auth/
└─ limite-de-frequencia.ts      avaliarLimite: janela deslizante, função pura

apps/api/src/app/comum/limite/
├─ limite.service.ts            os contadores, em memória, com teto de chaves
├─ limite.guard.ts              aplica as regras de cada rota
├─ limite.decorator.ts          @Limitar({ ip, email })
└─ limite.module.ts
```

## A regra

`avaliarLimite(registros, agora, regra)` recebe os instantes das tentativas anteriores e devolve
**permitido** (com os registros novos) ou **bloqueado** (com quanto falta). Sem relógio e sem
armazenamento: o instante entra por parâmetro, e a regra se exercita inteira em testes puros.

**Janela deslizante, e não fixa.** Com janela fixa, quem tenta `máximo` vezes no fim de uma
janela e `máximo` no começo da seguinte passa com o dobro do permitido em poucos segundos.

**A tentativa bloqueada não é registrada.** Se fosse, quem insiste estenderia o próprio
bloqueio sem limite, e o limite viraria punição.

## Os limites

| Rota                         | Por IP        | Por e-mail       |
| ---------------------------- | ------------- | ---------------- |
| `POST /auth/login`           | 20 por minuto | 10 em 15 minutos |
| `POST /auth/cadastro`        | 10 por hora   | —                |
| `POST /auth/esqueci-senha`   | 10 por hora   | **3 por hora**   |
| `POST /auth/redefinir-senha` | 20 por hora   | —                |

O **por e-mail** é o que protege a conta de ser martelada por muitos IPs e uma caixa de entrada
de ser inundada. O **por IP** cobre quem varre muitos e-mails de um lugar só. As duas coisas são
necessárias: cada uma cobre o que a outra não vê.

Ao estourar: `429`, cabeçalho `Retry-After` em segundos e a mensagem "Muitas tentativas. Tente
de novo em N minutos." — que o formulário do Angular já mostra, porque lê o `message` do corpo.

## Decisões

**O e-mail é normalizado como o contrato faz** (aparado, minúsculas). A coluna é `citext`:
`A@x.com` e `a@x.com` são a mesma conta para o banco, e seriam dois contadores para o limite —
tentativas de graça para o atacante.

**O limite de e-mail vale para quem não tem conta.** Barrar só e-mail com conta revelaria quem
tem conta, desfazendo o que a resposta idêntica de `esqueci-senha` protege.

**O guard roda antes da validação do corpo.** O limite precisa valer inclusive para requisições
malformadas, que são justamente o que um ataque manda. Os testes disparam corpo inválido de
propósito no cadastro, e assim nenhuma conta é criada.

**Teto de chaves.** Quem varre e-mails inventados cria uma chave por tentativa; sem teto, o
mecanismo que protege o servidor vira a forma de derrubá-lo por memória. Acima de 10.000 chaves
saem primeiro as expiradas e, se ainda for preciso, as que ficaram mais tempo sem uso. Sob
ataque isso pode esquecer um contador legítimo — a troca certa, porque a alternativa é crescer
sem limite.

**Em memória, de propósito.** O Norbit roda numa instância só, e um `Map` basta. Com mais de uma
instância cada uma contaria por si, e o limite efetivo seria multiplicado. O dia em que isso for
verdade, `LimiteService` passa a usar o Redis que já está no `docker-compose`, e só ele muda.
Reiniciar a API zera os contadores.

**Desligar só nos e2e.** `LIMITE_DE_FREQUENCIA=desligado` (no servidor que o Playwright sobe): os
testes entram dezenas de vezes seguidas com a mesma conta e a mesma origem, e se bloqueariam
sozinhos. Fica fora do `.env.example` com valor, para que ninguém o desligue em produção sem
querer.

## O trade-off que se escolheu

Limitar o login **por e-mail** significa que quem sabe o e-mail de outra pessoa consegue travar o
login dela por até 15 minutos, errando de propósito. É o trade-off clássico dos limites por
conta, e aqui o lado certo é proteger a conta: sem ele, uma senha fraca cai por força bruta
distribuída. A janela curta limita o dano.

## Como foi verificado

- 12 testes da regra, no domínio.
- 10 testes do guard contra um servidor HTTP de verdade: 429 com `Retry-After`, contadores
  separados por rota e por e-mail, normalização, corpo sem e-mail, e-mail que não é texto,
  desligado por configuração, teto de chaves.
- 6 testes contra as **rotas reais** de autenticação, subindo a aplicação inteira. Existem
  porque os do guard não detectam o esquecimento de um `@Limitar`, que deixaria uma rota
  pública aberta sem falhar nada.
- Mutação em dez pontos, todos pegos pelo teste certo: janela inclusiva, bloqueio sem folga,
  espera errada, e-mail sem normalizar, sem escopo de e-mail, sem `Retry-After`, sem teto, e
  três rotas sem o limite.

Duas das mutações pareciam pegas e **não compilavam**. O resumo dizia "PEGA", porque o
processo de teste falhava — mas por erro de tipo, não por teste. Foram refeitas de modo a
compilar, e só então contaram.

## O que ainda não existe

- **IP atrás de proxy.** `requisicao.ip` é o IP do cliente só se o Express confiar no proxy
  (`trust proxy`). Sem isso, atrás de um balanceador todos parecem vir do mesmo IP e o limite por
  IP vira um limite global. Decidir quando a hospedagem for escolhida.
- **Limite nas demais rotas.** Só as públicas de autenticação têm limite. As rotas de agenda,
  evento e tarefa exigem sessão; um limite por usuário delas fica para quando houver motivo.
- **CAPTCHA ou atraso progressivo** depois de várias falhas.
- **Aviso por e-mail** sobre tentativas de login em excesso.

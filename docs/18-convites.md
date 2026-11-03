# 18 — Convites

Uma agenda compartilhada precisa de uma forma de entrar nela: o dono convida por e-mail ou por
link, e quem recebe vê, aceita ou recusa. O servidor e a interface estão prontos; a interface
está descrita [mais abaixo](#a-interface).

```
libs/domain/src/lib/agendas/
└─ convite.ts                  avaliarConvite: a decisão de aceitar

libs/contracts/src/lib/agendas/
└─ convite.ts                  criarConviteSchema e os tipos de saída

apps/api/src/app/convites/
├─ convites.service.ts         criar, listar, revogar, previsão, aceitar, recusar
└─ convites.controller.ts      dois controllers: o do dono e o de quem recebeu

apps/api/src/app/comum/
└─ email.module.ts             um módulo de e-mail, usado pela recuperação e pelos convites
```

## As rotas

| Rota                                    | Quem                  | Faz                                   |
| --------------------------------------- | --------------------- | ------------------------------------- |
| `POST /api/agendas/:id/convites`        | dono da agenda        | cria, por e-mail ou por link          |
| `GET /api/agendas/:id/convites`         | dono da agenda        | lista os pendentes e vivos            |
| `DELETE /api/agendas/:id/convites/:cid` | dono da agenda        | revoga                                |
| `GET /api/convites/:token`              | **público**           | mostra de quê se está sendo convidado |
| `POST /api/convites/:token/aceitar`     | qualquer conta logada | entra na agenda                       |
| `POST /api/convites/:token/recusar`     | a conta convidada     | recusa (só convite por e-mail)        |

## Os dois tipos de convite

|              | Por e-mail                             | Por link                           |
| ------------ | -------------------------------------- | ---------------------------------- |
| Vale para    | a conta **com aquele e-mail**          | qualquer conta                     |
| Usos         | sempre um                              | os que o dono escolher (padrão 10) |
| Envia e-mail | sim                                    | não: o dono repassa o link         |
| Substitui    | o convite anterior para o mesmo e-mail | nada: pode haver vários            |
| Pode recusar | sim                                    | não: basta não usar                |

O convite por e-mail serve a quem ainda **não tem conta**: a pessoa cria a conta com aquele
e-mail e depois aceita.

## Decisões

**O convite é uma credencial, então a decisão é função pura.** `avaliarConvite` devolve um de
nove resultados, cada um com resposta HTTP própria: `404` para o que não existe, `403` para o
convite de outra conta, `410 Gone` para o que existiu e deixou de valer. A ordem das
verificações é a decisão: o que o dono decidiu (revogar) vence tudo; depois a validade
(recusado, usado, vencido); por fim quem aceita.

**O convite por e-mail só vale para aquele e-mail.** Encaminhar o link não dá acesso: quem o
recebeu de segunda mão não é quem o dono quis convidar. A comparação ignora caixa e espaços,
porque a coluna é `citext`.

**Só se convida para EDITOR, CONTRIBUTOR ou VIEWER.** O dono não é convidável: posse se
transfere, não se concede por link.

**Só o dono convida.** Convidar é `gerenciar-membros` na matriz de permissões, a mesma de
alterar papéis e remover gente. Quem não tem acesso à agenda recebe `404`, e não `403`, como
em toda rota de agenda.

**O token é guardado só como hash, e o link existe uma vez.** Como na recuperação de senha, um
vazamento do banco não entrega convites vivos. A consequência: nem o dono consegue recuperar o
link depois. Quem perder o link de um convite por link revoga e cria outro. A listagem nunca
traz token.

**Aceitar é idempotente.** Quem já é membro recebe sucesso **sem gastar um uso** e sem mudar o
papel: aceitar um convite de leitor não rebaixa um editor.

**A corrida pelo último uso se decide no banco.** Ler "ainda há uso" e gastá-lo são passos
separados, e entre eles cabe o outro aceite. O `updateMany` com `useCount < maxUses` dentro da
transação resolve: o Postgres reavalia o `where` depois de esperar o bloqueio da linha, então só
um dos dois encontra uso disponível. Há teste com dois aceites simultâneos.

**A previsão é pública.** Quem recebe o link precisa saber **de quê** está sendo convidado
antes de decidir criar conta. Quem tem o token já tem o segredo, então mostrar o nome da agenda
não vaza nada que o link não vazasse. Tem limite por IP.

**Um convite por link tem teto de usos por padrão (10).** Um link sem teto circula para sempre
sem ninguém ter decidido isso. O dono pode escolher até 100.

**Validade de 1 a 30 dias, padrão 7.** Um convite que vale para sempre é uma credencial que
ninguém lembra que existe.

**Revogar é escopado pela agenda.** O `where` leva o `calendarId`: sem ele, o dono da agenda A
revogaria convites da B sabendo só o identificador.

**Limite de frequência por e-mail convidado** (5 por hora): é o que impede o dono — ou quem
roubou a sessão dele — de inundar a caixa de entrada de alguém.

**A falha de envio não derruba o convite.** O convite existe e o dono recebe o link na resposta;
a falha vai para o log, e ele pode repassar o link por onde preferir.

## Como foi verificado

- 17 testes da regra no domínio, 14 de contrato.
- 30 testes de integração contra o Postgres, incluindo a corrida e os escopos.
- 9 testes pelas **rotas reais**, com a aplicação inteira e JWT: o ciclo completo, sessão
  exigida onde deve e pública onde deve, papel de dono recusado, identificador malformado.
- Mutação em 13 pontos, todos pegos: e-mail não conferido, esgotamento com folga a mais,
  expiração exclusiva, revogação sem precedência, convidar sem permissão, revogar sem escopo,
  uso sem condição (a corrida), "já é membro" ignorado, e-mail sem uso único, convite novo sem
  revogar o anterior, papel ignorado, listagem sem filtro de validade e aceitar sem sessão. Uma
  não compilava e foi refeita.

Duas coisas que o teste das rotas reais mostrou: os últimos testes recebiam `429`, porque cada
um cadastra duas contas e o limite de cadastro (10 por hora por IP, do
[17](17-limite-de-frequencia.md)) estourava — o limite funcionando contra o meu próprio teste;
e um `{ id: '' }` que escrevi como "não revoga nada" nos convites por link era um UUID inválido
e o Postgres recusaria.

## A interface

```
apps/web/src/app/
├─ auth/destino.ts                       para onde voltar depois de entrar (e o que recusar)
├─ convites/
│  ├─ convites.service.ts                HTTP: criar, listar, revogar, previsão, aceitar, recusar
│  ├─ papel.ts                           os papéis como a tela os chama (nunca o dono)
│  ├─ validar-convite.ts                 formulário → contrato, com o mesmo schema da API
│  ├─ painel-de-convites.{ts,html,scss}  o painel do dono, dentro de um diálogo
│  └─ paginas/convite.{ts,html}          a tela que o link do e-mail abre
└─ calendario/                           o botão "Compartilhar" na barra lateral
```

**A tela `/convite` não tem guard.** Ela precisa abrir para quem não tem conta e para quem tem
outra conta aberta no navegador. A previsão é pública, então aparece nos três casos; o que muda
é o que se oferece: sem sessão, **Entrar** e **Criar conta**; com sessão, **Aceitar** e
**Recusar** (só no convite por e-mail, que é o único recusável).

**Entrar e criar conta voltam para o convite.** O destino viaja em `voltarPara`, e os links
entre as duas telas o repassam: quem vai de "Entrar" para "Criar conta" no meio do caminho não
o perde. Antes o cadastro mandava sempre para o início, e quem veio de um convite chegava ao
calendário sem entender o que acontecera com ele.

**`destinoSeguro` recusa mais do que endereço absoluto.** `//outro-site.com` e `/\outro-site.com`
começam com barra e o navegador os trata como outro host; conferir só o primeiro caractere (o
que o login fazia) deixava passar. O Angular não os trataria como redirecionamento externo, mas
o helper vale por não depender disso.

**Quem abriu o link com a conta errada pode trocar de conta.** O convite por e-mail só vale para o
endereço a que foi enviado; a resposta `403` explica isso, e **Usar outra conta** encerra a
sessão e leva ao login com o `voltarPara` do convite.

**O painel é do dono.** O botão **Compartilhar** só aparece nas agendas em que a pessoa é dona:
convidar é `gerenciar-membros`, e a API recusaria qualquer outro. A tela não decide permissão —
só evita oferecer o que vai falhar.

**O papel padrão do painel é Leitor.** O menor privilégio como ponto de partida: quem convida
escolhe dar mais, e não precisa lembrar de dar menos. O dono não está na lista.

**O link recém-criado fica à vista, com o aviso.** Como a API guarda só o hash, o link existe
na resposta da criação e em nenhum outro lugar. O painel o mostra num campo que se seleciona ao
receber o foco, com **Copiar**, e o esquece ao fechar. Se a área de transferência não estiver
disponível, o campo continua selecionável.

**O formulário não tem regra própria.** `validarConvite` roda o `criarConviteSchema` da API. E
descarta o teto de usos quando há e-mail, porque o convite por e-mail é de um uso só.

### Como foi verificado

- 5 testes de `destinoSeguro`, 6 do serviço, 4 dos papéis e 8 de `validarConvite`.
- **5 e2e** com o Mailpit: convidar por e-mail quem não tem conta (cria a conta, volta ao convite
  e entra na agenda), o convite de outra conta recusado, o link mostrado uma vez e revogado, o
  link sem token e o botão só para o dono.
- Mutação nos e2e: tirar a condição "só o dono" e fazer o cadastro ignorar o `voltarPara` — cada
  uma derruba exatamente o teste que a protege. Uma primeira tentativa não compilava (import sem
  uso) e foi refeita.

O e2e do convite por e-mail **cria uma conta**, e isso quase o tornou um teste de uma execução só:
na segunda, o e-mail já existia. O `restaurarBanco` passou a varrer, além das contas do seed, as
de domínio `@e2e.norbit.dev` — e o teste usa esse domínio. A suíte inteira foi rodada duas vezes
seguidas para provar que a segunda não depende da primeira.

## O que ainda não existe

- **Gerenciar os membros pela tela**: listar quem está na agenda, mudar papel, remover. A API
  das agendas já tem as rotas; falta o painel.
- **Avisar o dono** quando alguém aceita ou recusa.
- **Reenviar** o e-mail de um convite pendente (hoje: revoga e cria outro).
- **Convidar várias pessoas de uma vez.**
- **Transferir a posse** da agenda.

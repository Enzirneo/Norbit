# 15 — Recuperação de senha

Quem esquece a senha perde a conta: era a lacuna mais antiga da Fase 1, e o que impedia
convidar alguém além do dono. O fluxo é pedir um link por e-mail, abri-lo e escolher uma senha
nova.

```
libs/domain/src/lib/auth/
└─ redefinicao-de-senha.ts     a regra do link: aceitar, desconhecido, já usado, expirado

libs/contracts/src/lib/auth/
└─ redefinicao.ts              schemas de entrada (a senha nova usa a regra do cadastro)

apps/api/src/app/
├─ comum/email.service.ts                 envio por SMTP (Mailpit em desenvolvimento)
└─ auth/redefinicao-de-senha.service.ts   pedir e redefinir

apps/web/src/app/auth/paginas/
├─ esqueci-senha.*             pede o link
└─ redefinir-senha.*           escolhe a senha nova
```

## O fluxo

1. `POST /api/auth/esqueci-senha` com o e-mail. **Sempre** responde `204`.
2. Se a conta existe, o servidor grava um pedido e envia o link
   `/redefinir-senha?token=…` ao e-mail.
3. `POST /api/auth/redefinir-senha` com o token e a senha nova. Troca a senha, marca o link
   como usado e **encerra todas as sessões** da conta, numa transação.

## Decisões

**O token é guardado só como hash.** O valor cru (256 bits aleatórios) vive apenas no e-mail.
Um vazamento do banco não entrega links vivos. É SHA-256 pelo mesmo motivo do refresh token: a
busca é feita _pelo_ hash, e um valor com essa entropia não tem dicionário que o alcance.
`TokensService.gerarTokenOpaco` serve aos dois.

**Quem pede não descobre se o e-mail tem conta.** A resposta é `204` com ou sem conta, e a
tela diz "se existe uma conta, o link está a caminho". Dizer "não encontramos esse e-mail"
transformaria a rota num oráculo de quem usa o Norbit, o mesmo raciocínio da mensagem única de
credencial inválida no login.

**O envio não é aguardado.** Esperar o SMTP só quando a conta existe tornaria a resposta mais
lenta para e-mails reais, e o tempo seria o oráculo que a resposta idêntica fechou. Uma falha
de envio vai para o log, não para a pessoa. O custo: se o provedor de e-mail cair, a pessoa
não é avisada na tela — ela percebe pela caixa vazia e pede de novo.

**Cada link vale uma vez, por meia hora.** O uso tem precedência sobre a expiração (um link
usado e vencido que reaparece continua sendo reuso). Link desconhecido e link já usado dão a
mesma mensagem; só o expirado é distinguido, porque quem tem o token legítimo precisa saber
que a saída é pedir outro.

**Um pedido novo cancela os anteriores.** Dois links vivos para a mesma conta dobrariam a
superfície sem ajudar ninguém.

**Dois usos simultâneos do mesmo link: só um passa.** Ler "está livre" e marcar "usado" são
passos separados, e entre eles cabe a outra requisição. O que decide é o
`updateMany … where usedAt is null` dentro da transação: só uma das requisições altera uma
linha. Há teste com duas chamadas em paralelo.

**Redefinir derruba todas as sessões.** Quem esquece a senha costuma ter uma sessão esquecida
em algum lugar — ou alguém com a senha antiga. Trocar a senha sem encerrar as sessões deixaria
essa pessoa dentro. O navegador de quem redefiniu também esquece a sessão local.

**`/redefinir-senha` não tem `exigeVisitante`.** Quem segue o link pode estar com outra conta
aberta no navegador, e ser devolvido ao calendário esconderia a tela que veio buscar.

## Como foi verificado

- 12 testes de integração contra o Postgres: hash no banco, e-mail sem conta, invalidação do
  link anterior, conta apagada, senha trocada, uso único, corrida, link vencido, token
  inventado, sessões derrubadas, hash Argon2id.
- 6 e2e com o **Mailpit de verdade**: o teste lê a caixa, abre o link e prova que a senha
  mudou entrando com a nova (e que a antiga deixou de valer).
- Mutação, seis pontos, todos pegos: sessões não revogadas, corrida sem `usedAt` nulo, pedido
  novo sem invalidar o anterior, token cru no banco, expiração exclusiva, uso sem precedência
  sobre a expiração.

Um defeito meu no caminho: dois testes contavam linhas de `password_resets` do banco **inteiro**,
e o e2e deixa pedidos da conta de desenvolvimento lá — falhavam sem mutação nenhuma. Passaram a
olhar só a conta do próprio teste. Outra asserção ("e-mail sem conta não cria nada") filtrava por
uma conta que não existe e nunca poderia falhar; hoje compara a contagem antes e depois.

## O que ainda não existe

- **Limite de frequência.** Nada impede alguém de pedir o link mil vezes para o e-mail de uma
  vítima (spam) ou de martelar o login. É a próxima pendência de segurança, e precisa de Redis
  ou de um contador no banco.
- **Aviso por e-mail quando a senha muda.** Quem tem a conta invadida precisaria saber.
- **E-mail em HTML.** O texto puro basta para o fluxo e não depende de cliente de e-mail.
- **Verificação de e-mail no cadastro** (`emailVerifiedAt` existe e não é usado).

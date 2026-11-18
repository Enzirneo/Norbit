# 22 — Trocar o e-mail

Duas rotas, na seção **E-mail** do [perfil](16-perfil.md):

- `POST /api/auth/trocar-email` com `{ senha, novoEmail }` — logada, pede a troca.
- `POST /api/auth/confirmar-email` com `{ token }` — pública, efetiva a troca.

O e-mail é a credencial da conta e o destino da [recuperação de senha](15-recuperacao-de-senha.md):
quem o controla controla a conta. Trocá-lo sem provar que a pessoa controla o endereço **novo** deixaria
uma sessão sequestrada redirecionar a recuperação. Por isso são dois passos, e nada muda até o segundo.

## Decisões

- **O link vai para o endereço novo.** Clicar nele é a prova de que a pessoa o controla. O pedido
  guarda o e-mail novo e só o **hash** do token (tabela `email_changes`, como `password_resets`); o
  valor cru existe só a caminho do e-mail. Vale 30 minutos e uma vez: reaproveita `avaliarRedefinicao` e
  `expiracaoDoLink` de `libs/domain`, porque é a mesma credencial de curta duração. Um pedido novo
  cancela o anterior.
- **Pede a senha**, como a troca de senha e o apagar da conta. Errada é 400 (não 401, que dispararia a
  renovação do interceptor). Limite de 10 em 15 minutos por IP.
- **Pedir responde igual haja ou não conta no endereço novo (204).** Dizer "esse e-mail já tem conta"
  daria a qualquer sessão, inclusive uma roubada, um jeito de descobrir quem usa o Norbit. Se o endereço
  já tem dono, nada é gravado nem enviado, e a tela diz "Se o endereço puder ser usado, enviamos um
  link". O envio não é aguardado, para o tempo da resposta não virar o oráculo que a resposta idêntica
  fechou. Trocar para o próprio e-mail é 400: não revela nada.
- **A corrida do endereço é fechada no banco.** Entre o pedido e o clique, outra pessoa pode cadastrar o
  mesmo endereço. A confirmação confia na constraint única de `users.email`: a violação vira 400
  ("Este endereço não pode mais ser usado") e a transação inteira desfaz, inclusive a marca de link
  usado. Duas confirmações simultâneas também se resolvem no banco: só uma encontra `usedAt` nulo.
- **Confirmar derruba todas as sessões.** Não há sessão atual a poupar (o link abre em qualquer
  aparelho, sem login), e trocar o e-mail é mexer na recuperação da conta; na dúvida, fecha. Também
  invalida links de redefinição de senha em aberto, que foram para o endereço antigo. A pessoa entra
  de novo com o endereço novo. O e-mail passa a constar como verificado (`emailVerifiedAt`).
- **O endereço antigo é avisado.** Quem sequestrou uma sessão e trocou o e-mail conta com o silêncio
  do dono; o aviso o quebra.
- **A página do link tem um botão.** Abrir um link não deve mudar a conta: pré-visualizadores de e-mail
  e de mensagens abrem links por conta própria. A rota `/confirmar-email` fica sem `exigeVisitante`,
  como a de redefinição, porque o link abre em qualquer aparelho.

## Como foi verificado

- 15 testes de integração contra o Postgres (link para o endereço novo e nada muda ainda; só o hash
  guardado; senha errada; o próprio e-mail; endereço alheio responde igual sem enviar nem gravar; pedido
  novo cancela o anterior; entra com o novo e não com o antigo; e-mail verificado; sessões derrubadas;
  aviso ao antigo; uso único; link desconhecido; vencido; endereço tomado no meio; conta apagada no
  meio), 6 de contrato, 2 de limite com a aplicação inteira, 2 do serviço HTTP e 5 e2e com o Mailpit
  (o link chega ao endereço novo e confirmar troca o login; derruba a sessão de quem pediu; senha
  errada; endereço com dono não envia nada; link inventado).
- Mutação, todas pegas: não conferir a senha, não derrubar as sessões, enviar mesmo com endereço
  tomado, não marcar o link como usado, avisar o endereço errado, não marcar verificado, não traduzir a
  corrida do endereço, e pedido novo não cancelar o anterior.
- O **seed** passou a varrer também por handle e por contas anonimizadas: o e2e deixa a Maria com outro
  e-mail, e a varredura só por e-mail morria na constraint do handle.

## O que ainda não existe

- **Exigir e-mail verificado** para alguma coisa. Hoje o cadastro não verifica o endereço; só a troca
  o marca como verificado.
- **Cancelar o pedido pela tela** (hoje ele vence em 30 minutos ou é substituído por outro).
- **Rastro de auditoria** da troca (quem pediu, de onde).

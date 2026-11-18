# 20 — Aparelhos conectados

`GET /api/auth/sessoes` e `DELETE /api/auth/sessoes/:id`, na seção **Aparelhos conectados** do
[perfil](16-perfil.md). Responde a "onde minha conta está aberta?" e deixa a pessoa derrubar um
aparelho sem precisar trocar a senha. É o complemento de [19](19-troca-de-senha.md): lá todos os
outros caem de uma vez; aqui a pessoa escolhe qual.

## Decisões

- **Aparelho = família de sessões.** Cada renovação revoga a linha anterior e cria outra
  ([07](07-autenticacao.md)), então a linha **viva** de uma família (não revogada, não vencida) é a
  única que diz de onde a pessoa está entrando agora. A lista mostra uma linha por família, com o
  `userAgent` e o IP da última renovação e o horário dela como "visto em". O identificador exposto é
  o `familyId`; o refresh token e o seu hash nunca saem do servidor.
- **O aparelho atual vem marcado, e não pode ser derrubado por aqui.** O cookie de refresh vai junto
  nos dois pedidos só para o servidor saber qual item é o de quem pede. Encerrar o próprio aparelho é
  o **Sair**, que também limpa o cookie; derrubá-lo daqui deixaria a pessoa com um cookie morto e um
  login "fantasma" até a próxima renovação. O servidor recusa (400) e a tela nem mostra o botão.
- **404 para sessão de outra conta e para sessão que já acabou.** As duas respondem igual, para o
  identificador não servir de sonda. Se a lista estava velha (o aparelho já tinha saído), a tela
  recarrega depois do erro.
- **Sem refresh identificado, nada vem marcado como atual**, e nenhuma sessão fica protegida: na
  dúvida, a pessoa vê todos e o servidor não presume nada.
- **Rótulo legível no cliente** (`descreverAparelho`): "Firefox · Windows" em vez do `userAgent` cru.
  É só um rótulo, não detecção para decidir comportamento: uma lista curta de regras, com a ordem
  importando (o Edge diz "Chrome" e "Safari"; o Android diz "Linux"), e um texto neutro para o que
  não se reconhece.
- **Controller próprio.** O `AuthController` já está no limite de parâmetros do construtor; as rotas
  de sessões não pertencem a ele de qualquer modo. O cookie (`cookie-de-refresh.ts`) é compartilhado.

## Como foi verificado

- 9 testes de integração (um item por aparelho, com o contexto da última renovação; só o atual
  marcado; nenhum marcado sem refresh; revogadas e vencidas ficam de fora; sessão de outra conta não
  aparece; derrubar um aparelho poupa o resto; recusa derrubar o atual; outra conta responde 404 e
  não é tocada; aparelho que já saiu responde 404), 2 do serviço HTTP, 9 do rótulo e 2 e2e com dois
  aparelhos de verdade (dois contextos de navegador).
- Mutação em quatro pontos, todos pegos: tirar a guarda do aparelho atual, revogar sem filtrar pelo
  dono, listar sem o filtro de validade, e a tela não tirar o item depois de desconectar.

## O que ainda não existe

- **"Desconectar todos os outros"** num clique (hoje é um por vez, ou trocar a senha).
- **Aviso por e-mail** de login em aparelho novo e de senha trocada.
- **Localização pelo IP.** Hoje o IP aparece cru; sem `trust proxy` configurado, atrás de um proxy ele
  seria o do proxy.

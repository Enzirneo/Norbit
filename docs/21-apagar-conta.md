# 21 — Apagar a conta

`POST /api/auth/apagar-conta` com `{ senha }`, na seção **Apagar conta** do [perfil](16-perfil.md).
A transferência de posse ([18](18-convites.md)) foi o que a destravou: sem ela, quem fosse dono de
uma agenda compartilhada não teria o que fazer com ela.

## Decisões

- **A linha do usuário fica, anonimizada.** Eventos e tarefas criados em agendas de outras pessoas
  apontam para o criador; apagar a linha levaria o histórico dessas pessoas junto (ou barraria a
  exclusão). O e-mail vira `excluida-<id>@excluido.norbit.invalid` (domínio reservado, nunca recebe
  nada), o handle e o nome são trocados ("Conta excluída"), o hash da senha e o avatar são
  apagados, e `deletedAt` é marcado. **E-mail e handle ficam livres** para um cadastro novo. O que
  a pessoa criou em agenda alheia continua, atribuído a "Conta excluída".
- **Pede a senha**, como a troca de senha: quem pegasse um aparelho desbloqueado não deve
  conseguir apagar a conta. Senha errada é 400 (não 401, que dispararia a renovação do
  interceptor), e a rota tem o mesmo limite: 10 em 15 minutos por IP.
- **Dona de agenda compartilhada com outros é barrada (409), com o nome das agendas.** Apagar a
  conta decidiria sozinha o destino da agenda dos outros; a pessoa passa a posse ou exclui a
  agenda antes. Os dois caminhos já existem. A **agenda padrão não entra** na regra: não se
  transfere e é a pessoal de quem está saindo (os outros membros dela, se houver, a perdem).
- **O que acontece com o resto**, tudo numa transação (ou a conta some por inteiro, ou nada
  muda):
  - as agendas de que é dona são excluídas (lógica, como `AgendasService.remover`);
  - sai de todas as agendas de que é membro;
  - convites pendentes que emitiu, e os endereçados ao seu e-mail, são revogados (o segundo
    impede que quem se cadastrar depois com o mesmo e-mail herde o convite);
  - tarefas atribuídas a ela ficam sem responsável;
  - participações, lembretes, notificações, assinaturas push, contas OAuth, pedidos de redefinição
    e preferências são apagados;
  - todas as sessões são revogadas e o cookie de refresh é limpo.
- **O access token vale até 15 minutos** sem consultar o banco. Nesse intervalo ele não abre
  nada: as agendas ficaram sem a linha de membro, e `/eu` reconsulta e responde 401.
- **Na tela, em dois passos:** o botão só abre a confirmação, que pede a senha. Depois de apagar,
  o cliente limpa a sessão local e vai para o login, sem chamar o logout de uma conta que já não
  existe.

## Como foi verificado

- 12 testes de integração (a conta não entra nem renova; e-mail e handle liberados; dados pessoais
  apagados; agendas excluídas; sai das agendas alheias e o que criou lá continua; agenda
  compartilhada em que está sozinha; barrada, com o nome, se há outros membros; passa depois de
  transferir a posse; senha errada não muda nada; convites emitidos revogados; convites ao e-mail
  liberado revogados; tarefas sem responsável), 5 de contrato, 1 de limite com a aplicação inteira,
  1 do serviço HTTP e 4 e2e.
- Mutação, todas pegas: tirar o bloqueio da agenda compartilhada, não conferir a senha, não
  revogar convites, remover só a linha de dono, não liberar o e-mail, e a tela não ir ao login.
  Quatro das primeiras tentativas não compilavam (total de testes 0) e foram refeitas.

## O que ainda não existe

- **Prazo para desfazer.** A exclusão é imediata; um período de carência (conta desativada por 30
  dias) exigiria uma rotina que a conclua.
- **Apagar o que ela criou em agendas alheias**, a pedido (LGPD): hoje fica anonimizado.
- **Aviso por e-mail** de que a conta foi apagada.
- **Exportar os dados** antes de apagar.

# 19 — Trocar a senha logado

`POST /api/auth/trocar-senha` com `{ senhaAtual, novaSenha }`, na seção **Senha** do
[perfil](16-perfil.md). É a segunda forma de mudar a senha; a primeira é a
[recuperação por link](15-recuperacao-de-senha.md). Elas diferem em **quem prova o quê**: lá a
prova é o link do e-mail, aqui a pessoa já tem sessão e a prova que falta é a **senha atual**.
Sem ela, quem pegasse um aparelho desbloqueado trocaria a senha e trancaria a dona da conta do
lado de fora.

## Decisões

- **Os outros aparelhos caem; este fica.** Quem troca a senha porque suspeita de acesso alheio
  precisa que o acesso alheio acabe, então toda sessão de outra família é revogada. A deste
  aparelho continua, para a pessoa não ser deslogada no meio do que fez de propósito. O
  aparelho é identificado pelo cookie de refresh, que vai junto na requisição só para isso — quem
  autentica é o Bearer.
- **Na dúvida, fecha.** Sem cookie, ou com o cookie de outra conta, nenhuma sessão é poupada.
  Um teste prova que o refresh de outra pessoa não livra as sessões desta (e que as dela não são
  tocadas).
- **A senha atual não passa pela política de tamanho** (`trocarSenhaSchema`): a conta pode ser
  anterior a uma política mais rígida, e recusar por tamanho impediria de trocar justamente uma
  senha antiga e fraca. A senha **nova** usa a regra do cadastro, importada e não copiada, e
  precisa ser diferente da atual.
- **Senha atual errada é 400, não 401.** O 401 dispara a renovação transparente do
  [interceptor](07-autenticacao.md); uma senha digitada errado não é sessão vencida.
- **Limite por IP: 10 em 15 minutos.** A rota exige sessão, mas quem roubou um access token
  poderia usá-la para adivinhar a senha atual. Sobra para quem erra a digitação e é pouco para
  quem tenta adivinhar. Um teste sobe a aplicação inteira e prova que o limite está ligado à
  rota.
- **Conta sem senha** (criada só por OAuth, previsto para o futuro) cai na mesma recusa de
  "senha atual incorreta".

## Como foi verificado

- 5 testes de integração (senha nova vale e a antiga não; atual errada não muda nada; outros
  aparelhos caem e este fica; sem sessão identificada derruba todas; refresh alheio não poupa),
  1 de limite na aplicação inteira, 5 de contrato, 1 do serviço HTTP e 3 e2e.
- Mutação em quatro pontos, todos pegos: derrubar também a sessão atual, não conferir a senha
  atual, tirar o limite da rota, e não limpar o formulário depois de usar. A primeira tentativa
  de mutação não compilava (variável sem uso) e o total de testes caiu de 197 para 176 — sinal de
  que a suíte nem rodou, não de que passou. Foi refeita.

## O que ainda não existe

- **Listar e revogar sessões** uma a uma (`userAgent` e `ipAddress` já são gravados para isso).
- **Avisar por e-mail** que a senha foi trocada.

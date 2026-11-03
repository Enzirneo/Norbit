# 16 — Perfil

Fecha a Fase 1: quem tem conta pode mudar o nome, o handle e o fuso horário. O e-mail e o
avatar de imagem ficaram de fora, pelos motivos abaixo.

```
libs/contracts/src/lib/auth/
└─ perfil.ts                       atualizarPerfilSchema

apps/api/src/app/
├─ perfil/                         PATCH /api/perfil
└─ auth/conflito-de-cadastro.ts    tradução da violação de unicidade (e-mail, handle)

apps/web/src/app/perfil/
├─ iniciais.ts                     as iniciais que fazem as vezes de avatar
├─ perfil.service.ts               grava e atualiza o usuário em memória
└─ paginas/perfil.*                a tela
```

## O que se pode alterar

| Campo  | Regra                                                                        |
| ------ | ---------------------------------------------------------------------------- |
| Nome   | o mesmo do cadastro (1 a 80 caracteres)                                      |
| Handle | o mesmo do cadastro: minúsculas, 3 a 20, letras, números e sublinhado; único |
| Fuso   | nome IANA, canonizado; recusa deslocamento fixo, como nas agendas            |

As regras são **importadas** do cadastro, e não copiadas: duas cópias divergem, e a divergência
seria um handle que o cadastro aceita e a edição recusa.

## Decisões

**O e-mail fica de fora.** É a credencial da conta e o destino da recuperação de senha. Trocá-lo
sem confirmar que a pessoa controla o endereço novo deixaria uma sessão sequestrada tomar a
conta. Precisa de confirmação por e-mail, que é entrega própria (e vai junto com a verificação
no cadastro, que também não existe).

**Avatar é de iniciais, sem upload.** Não há onde guardar arquivo, e escolher hospedagem está em
aberto. Primeira letra do primeiro e do último nome; `Array.from` em vez de indexar a string,
para um caractere fora do plano básico não ser partido ao meio.

**Trocar o handle não deixa redirecionamento.** O handle aparece em URL (`/@enzo`), então links
antigos quebram. A tela avisa. Reservar o handle antigo por um tempo é uma decisão de produto que
ainda não precisa ser tomada: hoje nenhuma página pública usa o handle.

**Sem identificador na URL.** `PATCH /api/perfil` edita sempre quem está pedindo, como as
preferências. Um `/usuarios/:id` convidaria a tentar o de outra pessoa.

**`updateMany` com `deletedAt: null`, e não `update`.** O `update` só aceita a chave única no
filtro, e uma conta apagada não deve ser editável por um token que ainda não expirou.

**A tela tem botão "Salvar"**, ao contrário das preferências, que salvam a cada alteração.
Preferência é ajuste fino e reversível; trocar o handle muda o endereço público da pessoa, e uma
alteração com esse peso não deve acontecer a cada tecla.

**O formulário recebe a forma canônica de volta.** Digitar `Enzo_Novo` e `america/manaus` mostra
`enzo_novo` e `America/Manaus` depois de salvar: o que o servidor guardou, não o que foi digitado.

## Uma coisa que ficou como estava

O access token carrega o `handle` (`sub` e `handle`). Depois de trocar o handle, o token em
circulação continua com o antigo até renovar (15 minutos). Nada no servidor lê o handle do token
— as rotas buscam o usuário no banco —, então não há efeito, mas fica registrado: se algo passar
a usar o handle do token, ele estará defasado.

## Como foi verificado

- 6 testes de integração contra o Postgres, 6 de contrato, 5 de iniciais e 5 e2e (inclusive
  recarregar a página e ver o valor salvo).
- Mutação em quatro pontos, todos pegos: conta apagada editável, conflito de handle virando erro
  cru, corpo vazio aceito, e-mail entrando pelo perfil.

A primeira rodada de mutação **não** pegou a conta apagada editável. O teste só conferia que a
chamada era recusada, e sem o filtro ela era recusada do mesmo jeito — pela segunda consulta,
**depois** de a edição já ter sido gravada. Passou a conferir que a linha não mudou.

## O que ainda não existe

- **Troca de e-mail**, com confirmação por e-mail.
- **Avatar de imagem**, que depende de decidir onde guardar arquivos.
- **Trocar a senha logado** (hoje só pela recuperação) e **listar e revogar sessões**.
- **Apagar a conta.**

# 09 — Agendas e Eventos

A API do núcleo da agenda: criar e compartilhar agendas, criar e consultar eventos, e as
três operações que uma série recorrente precisa. É a camada que consome o
[motor de recorrência](08-recorrencia.md) e a primeira em que existe dado de verdade.

Sem tela ainda, de propósito — a mesma ordem da recorrência. Com a interface pronta, a
tentação de resolver autorização e fuso horário no front é grande, e o resultado
divergente.

```
libs/domain/src/lib/agendas/
├─ permissoes.ts      quem pode o quê (função pura, a matriz inteira)
└─ dia-inteiro.ts     normalização de evento de dia inteiro

libs/contracts/src/lib/agendas/
├─ comum.ts           cor hex, fuso IANA, instante
├─ agenda.ts          criar/alterar agenda, papel de membro
└─ evento.ts          criar/alterar evento, consulta de intervalo

apps/api/src/app/agendas/
├─ acesso.service.ts  o único lugar que decide acesso
├─ agendas.service.ts CRUD e membros
└─ agendas.controller.ts

apps/api/src/app/eventos/
├─ eventos.service.ts CRUD, consulta por intervalo, operações de série
├─ intervalo.ts       o período que vai para o banco
├─ visivel.ts         da linha do banco para a resposta
└─ eventos.controller.ts
```

## Autorização: uma tabela, um lugar

| Ação                                | OWNER | EDITOR | CONTRIBUTOR | VIEWER |
| ----------------------------------- | ----- | ------ | ----------- | ------ |
| ver a agenda                        | ✅    | ✅     | ✅          | ✅     |
| criar evento                        | ✅    | ✅     | ✅          | ❌     |
| editar/excluir **qualquer** evento  | ✅    | ✅     | ❌          | ❌     |
| editar/excluir o **próprio** evento | ✅    | ✅     | ✅          | ❌     |
| alterar a agenda                    | ✅    | ❌     | ❌          | ❌     |
| excluir a agenda                    | ✅    | ❌     | ❌          | ❌     |
| gerenciar membros                   | ✅    | ❌     | ❌          | ❌     |

A matriz vive em `libs/domain/src/lib/agendas/permissoes.ts`, como função pura. Não é
preciosismo: **o erro clássico de autorização não é esquecer a verificação, é
espalhá-la.** Quatro controllers com quatro `if (papel === 'OWNER' || ...)` divergem na
primeira alteração, e divergência de autorização aparece como vazamento de dado.

Três decisões que a tabela esconde:

- **`CONTRIBUTOR` é o papel que faz uma agenda de time funcionar.** Todo mundo lança os
  próprios compromissos sem poder apagar os dos outros.
- **`EDITOR` mexe no conteúdo, não na agenda.** Ele edita qualquer evento, mas não
  renomeia a agenda da família nem convida ninguém.
- **Autoria amplia o que o papel concede; nunca substitui.** Um membro rebaixado a
  `VIEWER` perde a edição até dos eventos que ele mesmo criou — do contrário o
  rebaixamento não significaria nada para quem já havia criado coisas.

### O dono é dono por `ownerId`

`Calendar.ownerId` é a fonte da verdade do papel de dono, não a linha de `CalendarMember`.
Assim transferir a posse é trocar um campo, e o dono não consegue se trancar fora da
própria agenda apagando a própria linha de membro. A linha existe de qualquer forma,
porque a lista de membros precisa mostrá-lo.

### Agenda inexistente e agenda de outra pessoa dão a mesma resposta

**404 nos dois casos.** Responder 403 para o que existe e 404 para o que não existe
transforma a rota num oráculo: qualquer um descobre quais identificadores são reais
varrendo a API. É o mesmo raciocínio da mensagem única de credencial inválida em
[07](07-autenticacao.md).

Para quem **é** membro mas não tem o papel necessário, o 403 é correto e informativo: a
existência da agenda já não é segredo para ele.

### Sair exige menos que remover

`DELETE /agendas/:id/membros/eu` pede apenas `ver`; `DELETE /agendas/:id/membros/:quem`
pede `gerenciar-membros`. Separados porque sair é direito de quem entrou, e exigir
`gerenciar-membros` prenderia um `VIEWER` numa agenda que ele não quer mais — **o papel
mais restrito não pode ser também o mais preso.**

A rota literal vem **antes** da que tem parâmetro no controller: o Nest casa na ordem de
declaração, e `:membroId` capturaria o `eu`.

### Visibilidade `PRIVATE` é filtrada na consulta

Não na resposta. Filtrar depois de buscar deixaria o dado passar pela aplicação, e é
assim que ele acaba num log de erro ou numa contagem. E privacidade não é papel: nem o
`EDITOR`, que edita qualquer evento da agenda, vê o que foi marcado como privado.

## O que o banco garante, e o que a aplicação só explica

| Invariante                            | Onde está a garantia           |
| ------------------------------------- | ------------------------------ |
| uma agenda padrão por usuário         | índice parcial único           |
| fim do evento ≥ início                | CHECK `events_valid_range`     |
| cor é `#rrggbb` minúsculo             | CHECK nas cinco colunas de cor |
| lembrete aponta para evento OU tarefa | CHECK `reminders_one_target`   |

Os schemas Zod validam as mesmas coisas, mas o papel deles é outro: **o banco é a
garantia, o contrato é a mensagem decente.** Sem o schema, a violação chegaria como erro
500 de constraint.

As CHECKs de cor nasceram de um defeito encontrado sondando a API de fora — ver
[o que foi verificado](#o-que-foi-verificado-e-o-que-isso-encontrou).

## Evento de dia inteiro

A forma canônica é **meia-noite local a meia-noite local, com o fim exclusivo**, como a
RFC 5545 define para `DTEND` em forma de data. `isAllDay` é só uma marca; o que define o
comportamento é o que está gravado.

Fim exclusivo é o que faz a conta de sobreposição fechar sem um a-menos: um dia inteiro
tem a duração de **um dia**, e não de 23:59:59.

A normalização acontece na **escrita**. Sem ela, o mesmo "dia 15" chega de três clientes
em três formas — meia-noite local, 23:59:59, meia-noite UTC — e o evento aparece no dia
errado para quem não está no fuso do servidor.

**A propriedade que resolve a ambiguidade do que chega é a idempotência.** Um cliente
manda o fim como instante dentro do último dia; outro já manda a meia-noite exclusiva.
Normalizar duas vezes tem de dar o mesmo resultado, ou um PATCH que não mexe nas datas
empurraria o evento um dia para frente a cada salvamento.

Nas viradas de horário de verão o dia inteiro dura 23 ou 25 horas, e isso é o correto:
"o dia 8" vai da meia-noite do 8 à meia-noite do 9, não 24 horas cravadas.

### E isso expôs um a-menos no motor de recorrência

O intervalo consultado passou a ser **semiaberto**: `[de, ate)`. A primeira versão de
`seCruzam` fechava a borda de baixo (`fim >= de`), e com o fim exclusivo isso ficou
visível: o dia inteiro do dia 15 termina exatamente na meia-noite que abre o 16, e
aparecia nas duas visões.

O marco de duração zero ("entrega do relatório") é a exceção, e está escrito como tal:
`fim > de` o descartaria do intervalo que começa nele, e ele não apareceria em visão
nenhuma. Tratado como ponto, cai em **exatamente um** dos dois intervalos vizinhos.

## As rotas

| Método | Rota                                            | Exige               |
| ------ | ----------------------------------------------- | ------------------- |
| GET    | `/api/agendas`                                  | sessão              |
| POST   | `/api/agendas`                                  | sessão              |
| PATCH  | `/api/agendas/:id`                              | `editar-agenda`     |
| DELETE | `/api/agendas/:id`                              | `excluir-agenda`    |
| GET    | `/api/agendas/:id/membros`                      | `ver`               |
| PATCH  | `/api/agendas/:id/membros/:quem`                | `gerenciar-membros` |
| DELETE | `/api/agendas/:id/membros/:quem`                | `gerenciar-membros` |
| DELETE | `/api/agendas/:id/membros/eu`                   | `ver`               |
| GET    | `/api/eventos?de=…&ate=…&agendas=…`             | sessão              |
| POST   | `/api/agendas/:id/eventos`                      | `criar-evento`      |
| PATCH  | `/api/eventos/:id`                              | `editar-evento`     |
| DELETE | `/api/eventos/:id`                              | `excluir-evento`    |
| DELETE | `/api/eventos/:id/ocorrencias/:inicio`          | `excluir-evento`    |
| POST   | `/api/eventos/:id/ocorrencias/:inicio/destacar` | `editar-evento`     |

A criação de evento fica **sob a agenda** porque um evento não existe fora de uma: a
agenda é a unidade de permissão, e tê-la na URL deixa a autorização explícita em vez de
escondida num campo do corpo.

Nenhuma rota recebe o identificador de quem está pedindo. Ele vem do token — aceitá-lo do
cliente seria oferecer a troca de identidade de graça.

### A consulta de intervalo

É a operação que define o produto, e ela não é um `findMany`: uma série recorrente é
**uma linha** no banco, e o que a tela precisa são as ocorrências dela no intervalo.

```
agendas visíveis  →  pré-filtro no Postgres  →  exceções de cada série  →  expandir
```

Três decisões no caminho:

- **O pré-filtro é de propósito mais largo que a expansão** (`endsAt >= de` em vez de
  `>`). Pré-filtro que descarta demais perde evento; `expandir` aplica a borda exata.
- **A série é encontrada por `recurrenceUntil`, não por `startsAt` no intervalo.** Um
  filtro por início dentro da janela descartaria a linha antes de expandir, e a série
  sumiria de todas as visões seguintes. É para isso que existe a cópia desnormalizada do
  `UNTIL`, e o índice `[calendarId, recurrenceRule, recurrenceUntil]`.
- **Agenda pedida que a pessoa não vê é ignorada, não recusada.** Recusar confirmaria que
  aquele identificador existe, e a tela de calendário não tem o que fazer com esse erro.

Teto de 400 dias por consulta. A visão mais longa do produto é um ano; recusar na entrada
dá uma mensagem que diz o que fazer, em vez de deixar a expansão estourar o limite dela.

### As três operações de uma série

Agora completas — o [08](08-recorrencia.md) descrevia o motor "sem o volante".

| O que a pessoa faz | Como é resolvido                                              |
| ------------------ | ------------------------------------------------------------- |
| editar todos       | `PATCH /eventos/:id` altera a linha-mãe                       |
| excluir só este    | a data entra em `excludedDates`; a expansão a remove          |
| editar só este     | uma linha filha com `recurrenceParentId` e `originalStartsAt` |

Quatro cuidados que os testes cobrem:

- **A ocorrência destacada não pode aparecer duas vezes.** A expansão da série-mãe
  suprime a instância pelo `originalStartsAt` da filha. É o defeito mais visível desta
  parte: o evento duplicado na tela.
- **As exceções são buscadas por `recurrenceParentId`, não pelo intervalo.** Uma filha
  movida para fora da janela consultada precisa continuar suprimindo a instância original
  dentro dela.
- **Filha excluída continua suprimindo.** Quem apagou uma ocorrência já destacada quis que
  ela desaparecesse; parar de suprimir faria a instância original ressuscitar no lugar.
- **Destacar uma data que a regra nunca geraria é recusado.** Seria uma linha que a
  expansão jamais suprimiria: um evento fantasma, sem como ser alcançado pela série.

`excludedDates` e `originalStartsAt` são mecanismos **separados** de propósito: um é a
exclusão, o outro é a substituição. Separá-los é o que permite desfazer um sem o outro.

## Fuso horário e cor, nos contratos

### `fusoIana` valida **e canoniza**

Duas descobertas, as duas medidas no runtime:

1. **O `Intl` aceita deslocamento fixo.** `timeZone: '-03:00'` não lança — a ES2024 passou
   a permitir essa forma. Aceitá-la destruiria em silêncio a razão de o campo existir:
   `-03:00` é um número, não um lugar, e não sabe quando o horário de verão começa. Um
   evento semanal gravado assim deslizaria uma hora na virada. Recusado.
2. **O `Intl` normaliza.** `us/pacific` e `America/Los_Angeles` são o mesmo fuso para ele,
   e `america/sao_paulo` resolve para a grafia correta. Então o valor guardado é o
   canônico, e não o que chegou — o fuso é comparado e agrupado como texto, e duas
   grafias do mesmo lugar viram dois fusos.

`Intl.supportedValuesOf('timeZone')` não serve como lista branca: deixa de fora o `UTC` e
todos os apelidos históricos.

### O padrão só existe no schema de criação

Um PATCH com os padrões herdados do schema compartilhado traria `color: '#6d7cff'` e a
agenda mudaria de cor sozinha — o clássico "editei o nome e a agenda ficou azul". Os
campos são declarados uma vez **sem** padrão; a criação os aplica, a atualização não.

E `null` é apagar, ausente é não mexer. São coisas diferentes, e sem distingui-las não há
como remover uma descrição.

### A regra de recorrência não é validada no contrato

Quem sabe ler RRULE é `libs/domain`, e `libs/contracts` não pode depender dela (ver as
fronteiras em `eslint.config.mjs`). No contrato ela é só texto com teto de tamanho; o
serviço a passa por `lerRrule`, que **recusa** o que não implementa, e a recusa volta como
400 com a mensagem da própria regra.

Sem isso a regra entraria no banco e toda consulta daquela agenda passaria a quebrar —
longe da requisição que a causou, e para todos os membros.

## O que foi verificado, e o que isso encontrou

A matriz de permissões e a normalização de dia inteiro foram escritas com teste antes, e
depois **verificadas por mutação** — a lição do [08](08-recorrencia.md): teste verde não
prova que ele pega algo.

| Defeito plantado                                     | Resultado         |
| ---------------------------------------------------- | ----------------- |
| `CONTRIBUTOR` ignora a autoria                       | 1 teste falhou    |
| `EDITOR` ganha `gerenciar-membros`                   | 2 testes falharam |
| papel desconhecido libera em vez de recusar          | 1 teste falhou    |
| dia inteiro sempre ganha um dia (perde idempotência) | 1 teste falhou    |
| dia inteiro sem o piso de um dia                     | 1 teste falhou    |
| meia-noite em UTC em vez de local                    | 7 testes falharam |
| borda do intervalo volta a ser inclusiva             | 1 teste falhou    |
| filhas não entram nas datas excluídas                | 3 testes falharam |
| pré-filtro exige a série começar no intervalo        | 1 teste falhou    |
| regra não suportada passa em silêncio                | 1 teste falhou    |
| `PRIVATE` deixa de ser filtrado                      | 1 teste falhou    |
| autoria do evento não é verificada                   | 1 teste falhou    |

Quatro achados que valem mais que os testes verdes:

**1. Um guard que não guardava nada.** `capacidadesDe` usava `Object.hasOwn` antes de ler
a matriz, com um comentário dizendo que era a defesa contra papel inválido. A mutação
mostrou que **nenhum teste** notava a remoção dele — porque a indexação já devolvia
`undefined` sozinha. A defesa real é o `?? false` / `?? 'nenhum'` de quem chama, e é isso
que o comentário diz agora. Comentário afirmando ser defesa, sobre código que não defendia,
é pior que código ausente.

**2. Dois filtros que parecem o mesmo e não são.** Em `minhasAgendas`, o `OR` do `where` e
o descarte por `papelNa` filtram a mesma coisa. Remover o `OR` não quebra teste nenhum —
ele é **desempenho**; o descarte é **correção**. Está escrito no código para que ninguém
trate o `where` como a fronteira de segurança, nem o remova achando que é redundante.

**3. Uma afirmação sem teste.** "O dono não se tranca fora apagando a própria linha de
membro" estava no comentário e em lugar nenhum mais: a mutação que removia o caminho do
`ownerId` passava, porque o dono também tem linha de membro e os dois caminhos concordam
sempre. O teste que força a divergência foi escrito depois.

**4. A cor maiúscula que não passava por contrato nenhum.** Sondando a API de fora, a
agenda criada no cadastro voltou com `#6D7CFF`. O contrato `corHex` normaliza para
minúscula, mas o valor vinha do `@default` do `schema.prisma` — e um DEFAULT do banco não
passa por validação de aplicação. Corrigido nos três defaults, normalizado nas linhas
existentes, e **fechado com CHECK nas cinco colunas de cor**: validação na aplicação é a
mensagem decente, a restrição é a garantia.

### E duas armadilhas de ferramenta, achadas no caminho

**O client do Prisma carrega a própria cópia do `@default`.** Alterar o `schema.prisma`
sem rodar `npm run db:generate` deixa o client gravando o valor antigo. Aqui isso virou
erro de CHECK constraint, que é o melhor resultado possível — antes disso seria dado
errado em silêncio.

**O cache do Nx não enxergava o client gerado.** `libs/db/src/generated/` está no
`.gitignore`, e o Nx não inclui arquivos ignorados no hash das tarefas. Então regerar o
client **não invalidava cache nenhum**, e um `nx serve` podia restaurar um bundle
construído contra outro schema — o que custou três sondas falsas até a causa aparecer.
Resolvido declarando o schema e as migrations como `sharedGlobals` no `nx.json`, e
verificado: alterar o schema agora dá cache miss em toda tarefa.

### Verificado de fora, por HTTP

Rotas exercitadas com a API de pé, não só por teste de serviço: cadastro criando a agenda
padrão, série semanal expandindo em cinco ocorrências, exclusão de ocorrência pelo pipe de
instante na rota, destacamento sem duplicar, e as recusas — instante malformado (400),
UUID malformado (400), intervalo de 500 dias (400), `BYSETPOS` (400 com a mensagem da
regra), sem token (401).

## O que ainda não existe

- **Adicionar membro.** Entrar numa agenda é por convite (`CalendarInvite`, com token e
  e-mail), e isso é o bloco de compartilhamento do [roadmap](05-roadmap.md). Alterar
  papel, remover e sair já existem porque são consequência direta da matriz.
- **Transferir a posse.** Promover alguém a `OWNER` não é alteração de papel: troca
  `Calendar.ownerId` e exige confirmação própria. Por isso o papel de dono não é
  atribuível pela rota de papéis.
- **Marcar outra agenda como padrão.** Hoje a padrão é a criada no cadastro, e ela não
  pode ser excluída.
- **Tarefas.** `Task` está no banco e no [03](03-modelo-de-dados.md), sem rota ainda.
- **Qualquer tela.** Esta entrega é só a API.

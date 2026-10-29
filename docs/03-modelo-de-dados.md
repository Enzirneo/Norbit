# 03 — Modelo de Dados

O esquema completo está em [`prisma/schema.prisma`](../prisma/schema.prisma), comentado
campo por campo, e a migration SQL pronta em
[`prisma/migrations/`](../prisma/migrations/). Este documento explica o **porquê** das
decisões e serve de referência para executar a criação do banco.

O schema foi validado com `prisma validate` (Prisma 7.10.1) e **aplicado num Postgres
17 real**: 17 tabelas mais a de controle do Prisma, com as quatro restrições extras
conferidas no banco e testadas contra dados inválidos (ver o fim deste documento).

## Mapa de relações

```
User ──1:1── UserSettings
  │
  ├──1:N── Session · OAuthAccount · PushSubscription · Notification
  │
  ├──1:N── Calendar (como dono)
  │
  └──N:M── Calendar  via  CalendarMember  (papel · cor própria · oculta · silenciada)

Calendar
  ├──1:N── CalendarInvite
  ├──1:N── Event ──N:M── User  via  EventParticipant  (RSVP)
  │           ├──1:N── Reminder
  │           ├──N:M── Tag  via  EventTag
  │           └──auto-relação── Event  (ocorrência destacada → série-mãe)
  ├──1:N── Task
  │           ├──auto-relação── Task  (subtarefa → tarefa-mãe)
  │           ├──1:N── Reminder
  │           └──N:M── Tag  via  TaskTag
  ├──1:N── Tag
  └──1:N── Activity   (log append-only: quem fez o quê)
```

## As cinco decisões que importam

### 1. Datas em UTC, mas com o fuso de origem guardado

Todo `DateTime` é `timestamptz` e armazena UTC. Mas `Event` guarda também o campo
`timeZone`, e isso não é redundância.

O motivo é a recorrência. "Toda terça às 9h" precisa continuar às 9h **locais** depois
de uma mudança de horário de verão. Se só guardássemos UTC, a ocorrência deslizaria uma
hora. Expandir um RRULE corretamente exige conhecer o fuso em que a regra foi escrita.

### 2. Recorrência por regra, não por materialização

Duas abordagens existem para eventos recorrentes:

| Abordagem              | Como funciona                                                         | Problema                                                                                 |
| ---------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Materializar           | Criar uma linha por ocorrência                                        | "Todo dia, para sempre" gera linhas infinitas; editar a série vira atualização em massa  |
| **Guardar a regra** ✅ | Uma linha com o RRULE, expandida sob demanda para o intervalo visível | Exige a função de expansão, que fica em `libs/domain` e é compartilhada pelos dois lados |

Escolhemos a segunda. As três operações que o usuário espera ficam assim:

- **"Editar todos"** → altera a linha-mãe
- **"Excluir só este"** → adiciona a data ao array `excludedDates` da mãe
- **"Editar só este"** → cria uma linha filha com `recurrenceParentId` apontando para a
  mãe e `originalStartsAt` guardando a data que ela substitui; a expansão sabe suprimir
  aquela instância da série

O campo `recurrenceUntil` é uma cópia desnormalizada do `UNTIL` do RRULE. Existe só para
que a consulta de intervalo possa descartar séries já encerradas usando índice, em vez
de fazer o parse do RRULE de cada linha.

### 3. Privacidade resolvida no servidor

`Event.visibility` e `Task.visibility` têm dois estados: `INHERITED` (visível para os
membros da agenda) e `PRIVATE` (só para quem criou).

A regra é filtrada na query, não no front-end. Um evento privado **não aparece na
resposta da API** para os outros membros. Esconder no cliente seria falso: qualquer
pessoa abriria o DevTools e leria o dado.

### 4. Cor em três níveis

É o que permite sobrepor várias agendas e ainda enxergar algo:

1. `Calendar.color` — a cor que o dono definiu para a agenda
2. `CalendarMember.colorOverride` — a cor com que **este membro** vê essa agenda, sem
   alterar o que os outros veem
3. `Event.color` — exceção para um evento específico

A resolução é o primeiro valor não nulo lendo de baixo para cima.

### 5. Chaves UUID v7, não v4

UUID v4 é aleatório, então inserções caem em posições espalhadas do índice B-tree,
fragmentando-o e piorando a escrita com o tempo. UUID v7 tem prefixo de timestamp: as
inserções ficam na mesma vizinhança do índice e, de graça, os IDs ficam ordenáveis por
data de criação. Geramos na aplicação (`uuidv7()` do pacote `uuidv7`), não no banco.

## Consultas que o esquema precisa servir bem

A principal é "todos os eventos destas N agendas entre as datas X e Y", disparada a cada
navegação do calendário. É servida pelo índice `events(calendar_id, starts_at, ends_at)`,
e os eventos recorrentes vêm de uma segunda consulta sobre
`events(calendar_id, recurrence_rule, recurrence_until)`, expandidos em memória.

As outras consultas previstas e seus índices:

| Consulta                                | Índice                                        |
| --------------------------------------- | --------------------------------------------- |
| Agendas visíveis de um usuário          | `calendar_members(user_id, is_hidden)`        |
| Não lidas + lista de notificações       | `notifications(user_id, read_at, created_at)` |
| Tarefas abertas de uma agenda por prazo | `tasks(calendar_id, completed_at, due_at)`    |
| Minhas tarefas atribuídas               | `tasks(assignee_id, completed_at)`            |
| Feed de atividade de uma agenda         | `activities(calendar_id, created_at)`         |
| Convites pendentes de um e-mail         | `calendar_invites(email, status)`             |

## Como criar o banco

A migration inicial **já está escrita** em
[`prisma/migrations/20261028120000_init/migration.sql`](../prisma/migrations/20261028120000_init/migration.sql).
Ela foi gerada pelo próprio Prisma a partir do schema, e já inclui as quatro restrições
que o Prisma não expressa no schema. Você não precisa editá-la.

```bash
# 1. Subir a infraestrutura
docker compose up -d

# 2. Configurar o ambiente
cp .env.example .env

# 3. Instalar dependências (já no package.json desde a Fase 0)
npm install

# 4. Gerar o client e aplicar a migration
npm run db:generate
npm run db:migrate

# 5. Popular com dados de desenvolvimento
npm run db:seed

# 6. Conferir visualmente
npm run db:studio          # ou Adminer em http://localhost:8080
```

> **Aplicada e verificada.** `prisma migrate deploy` rodou num Postgres 17 em Docker, as
> 17 tabelas existem, e as três restrições escritas à mão rejeitaram dados inválidos
> quando testadas de propósito:
>
> | Tentativa                               | Resultado                                                                          |
> | --------------------------------------- | ---------------------------------------------------------------------------------- |
> | Segunda agenda padrão para o mesmo dono | `duplicate key value violates unique constraint "calendars_one_default_per_owner"` |
> | Evento terminando antes de começar      | `violates check constraint "events_valid_range"`                                   |
> | Lembrete sem evento nem tarefa          | `violates check constraint "reminders_one_target"`                                 |
> | Cor em maiúsculas                       | `violates check constraint "calendars_color_hex"`                                  |

> **Cinco restrições a mais, na segunda migration.** `20261029024149_cores_em_minusculo`
> acrescentou um CHECK de formato em cada uma das cinco colunas que guardam cor
> (`calendars`, `tags`, `user_settings`, `calendar_members`, `events`): `#rrggbb`
> minúsculo, sempre.
>
> Elas nasceram de um defeito real. O contrato `corHex` já normalizava a entrada para
> minúscula, mas os `@default` desta migration inicial estavam em maiúsculas — e um
> DEFAULT do banco **não passa por validação de aplicação nenhuma**. A agenda criada junto
> com a conta era a única linha do sistema com a grafia errada, e isso só apareceu
> sondando a API de fora. Ver [09](09-agendas-e-eventos.md).

### Duas pegadinhas do Prisma 7

1. **A URL do banco não vive mais no `schema.prisma`.** Desde a versão 7 ela fica em
   [`prisma.config.ts`](../prisma.config.ts), na raiz. Um `datasource` com `url` no
   schema agora é erro de validação (P1012).
2. **O gerador mudou de nome:** `prisma-client`, não mais `prisma-client-js`.

Além disso, o Prisma 8 (hoje em release candidate) exige Node ≥ 22.18, e a sua máquina
está no 22.14. Fixe a major 7 no `package.json` por enquanto, ou atualize o Node antes
de migrar.

### Por que as restrições estão no banco, e não só no código

O Prisma não expressa índices parciais nem CHECK constraints no schema, então elas foram
escritas à mão no fim da migration. Valem estar ali porque é o banco que impede o dado
inválido de existir — independente de qual parte da aplicação, script de manutenção ou
seed tentou gravá-lo.

E a lista de "qual parte" é maior do que parece: o caminho que furou a normalização de cor
não foi um controller esquecido, foi o **valor padrão do próprio banco**. Validação na
aplicação é a mensagem decente; a restrição é a garantia.

### Nomes das colunas

As **tabelas** são snake_case e plurais (via `@@map`); as **colunas** ficam em camelCase,
como o Prisma gera por padrão. A consequência prática: em SQL escrito à mão, toda coluna
precisa de aspas duplas — `WHERE "startsAt" > now()`, não `WHERE startsAt > now()`.

## Dados de semeadura

`prisma/seed.ts` (`npm run db:seed`) cria dois usuários, uma agenda pessoal para cada,
uma agenda compartilhada entre os dois com papéis diferentes, quatro eventos — um
recorrente, um de dia inteiro, um privado e um comum — e duas tarefas, uma delas
atribuída à outra pessoa. É o que permite trabalhar na interface sem cadastrar tudo à
mão a cada reset do banco.

### Onde vive o Prisma Client

O gerador do Prisma 7 **emite TypeScript** no diretório de saída em vez de um pacote
compilado em `node_modules`, e por isso `@prisma/client` não reexporta mais nada —
importar de lá falha.

A saída fica em `libs/db/src/generated/`, dentro da lib **`@norbit/db`**, que é quem
reexporta o client para o resto do monorepo. Ninguém importa um caminho `generated/`
relativo: importa-se de `@norbit/db`. O diretório está fora do controle de versão e é
regerado por `npm run db:generate` — código gerado versionado viraria conflito de merge
a cada alteração do schema, e ficaria desatualizado em silêncio.

Duas consequências práticas:

1. **O CI tem de gerar antes de qualquer coisa.** Os jobs de `lint`, `test`, `build` e
   `e2e` rodam `npm run db:generate` logo após o `npm ci`; sem isso, `@norbit/db` não
   existe e os três falham por módulo não encontrado. Os jobs que não conectam no banco
   ainda precisam de uma `DATABASE_URL` de fachada, porque o `prisma.config.ts` resolve
   a variável de forma estrita e aborta se ela faltar.
2. **O código gerado fica fora do lint e do Prettier.** São milhares de linhas por
   arquivo: não passariam nos limites de Clean Code, e não há o que revisar nelas.

A v7 também exige um **driver adapter** para conexão direta: o client é instanciado com
`new PrismaClient({ adapter: new PrismaPg({ connectionString }) })`, não só com a URL.
É o que o `PrismaService` faz, e o teste dele é de integração contra o Postgres de
verdade — um mock ali testaria o mock, não a ligação do adapter.

### Apagar um usuário não apaga as agendas dele

`Calendar.ownerId` é `Restrict`, não `Cascade`, e isso é deliberado: uma agenda
compartilhada pertence ao grupo, não só a quem a criou. Apagar a conta do dono e levar
com ela o histórico de todos os membros seria destruição silenciosa de dado alheio.
A exclusão de um usuário com agendas **falha**, e quem for implementar a remoção de
conta na Fase 1 vai ter de decidir explicitamente o que acontece com cada agenda —
transferir a posse ou apagar junto, com confirmação.

O efeito colateral apareceu no seed: ele presumia cascade e só funcionava em banco
vazio; na segunda execução morria com `P2003` em `calendars_ownerId_fkey`. Agora ele
apaga as agendas antes dos usuários e é idempotente — rodar duas vezes seguidas dá o
mesmo resultado.

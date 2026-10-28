# 03 — Modelo de Dados

O esquema completo está em [`prisma/schema.prisma`](../prisma/schema.prisma), comentado
campo por campo, e a migration SQL pronta em
[`prisma/migrations/`](../prisma/migrations/). Este documento explica o **porquê** das
decisões e serve de referência para executar a criação do banco.

O schema foi validado com `prisma validate` (Prisma 7.10.1): **válido**.

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

| Abordagem | Como funciona | Problema |
|---|---|---|
| Materializar | Criar uma linha por ocorrência | "Todo dia, para sempre" gera linhas infinitas; editar a série vira atualização em massa |
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

| Consulta | Índice |
|---|---|
| Agendas visíveis de um usuário | `calendar_members(user_id, is_hidden)` |
| Não lidas + lista de notificações | `notifications(user_id, read_at, created_at)` |
| Tarefas abertas de uma agenda por prazo | `tasks(calendar_id, completed_at, due_at)` |
| Minhas tarefas atribuídas | `tasks(assignee_id, completed_at)` |
| Feed de atividade de uma agenda | `activities(calendar_id, created_at)` |
| Convites pendentes de um e-mail | `calendar_invites(email, status)` |

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

# 3. Instalar as dependências do Prisma (dotenv é exigido por prisma.config.ts)
npm i -D prisma tsx && npm i dotenv

# 4. Aplicar a migration
npx prisma migrate deploy

# 5. Conferir visualmente
npx prisma studio          # ou Adminer em http://localhost:8080
```

> **Ainda não aplicada contra um banco real.** O DDL foi gerado pelo Prisma (`migrate
> diff`) e o schema passou no `prisma validate`, mas o Docker Desktop estava desligado
> no momento em que isto foi escrito, então a execução do SQL não foi verificada de
> ponta a ponta. Se o passo 4 falhar, é nas quatro linhas finais acrescentadas à mão que
> vale olhar primeiro.

### Duas pegadinhas do Prisma 7

1. **A URL do banco não vive mais no `schema.prisma`.** Desde a versão 7 ela fica em
   [`prisma.config.ts`](../prisma.config.ts), na raiz. Um `datasource` com `url` no
   schema agora é erro de validação (P1012).
2. **O gerador mudou de nome:** `prisma-client`, não mais `prisma-client-js`.

Além disso, o Prisma 8 (hoje em release candidate) exige Node ≥ 22.18, e a sua máquina
está no 22.14. Fixe a major 7 no `package.json` por enquanto, ou atualize o Node antes
de migrar.

### Por que as quatro restrições estão no banco, e não só no código

O Prisma não expressa índices parciais nem CHECK constraints no schema, então elas foram
escritas à mão no fim da migration. Valem estar ali porque é o banco que impede o dado
inválido de existir — independente de qual parte da aplicação, script de manutenção ou
seed tentou gravá-lo.

### Nomes das colunas

As **tabelas** são snake_case e plurais (via `@@map`); as **colunas** ficam em camelCase,
como o Prisma gera por padrão. A consequência prática: em SQL escrito à mão, toda coluna
precisa de aspas duplas — `WHERE "startsAt" > now()`, não `WHERE startsAt > now()`.

## Dados de semeadura

Vale um `prisma/seed.ts` para desenvolvimento, criando: dois usuários, uma agenda pessoal
para cada, uma agenda compartilhada entre os dois com papéis diferentes, alguns eventos
(incluindo um recorrente, um de dia inteiro e um privado) e algumas tarefas. É o que
permite trabalhar na interface sem cadastrar tudo à mão a cada reset do banco.

# Norbit — Documentação de Planejamento

Agenda compartilhada, bonita e customizável. Este diretório contém o planejamento
completo do projeto, decidido antes da primeira linha de código de produto.

## Índice

| Documento                                               | Conteúdo                                                          |
| ------------------------------------------------------- | ----------------------------------------------------------------- |
| [01 — Visão e Escopo](01-visao-e-escopo.md)             | O que o Norbit é, para quem, o que entra no MVP e o que fica fora |
| [02 — Arquitetura](02-arquitetura.md)                   | Stack, monorepo, camadas, Docker, autenticação, tempo real        |
| [03 — Modelo de Dados](03-modelo-de-dados.md)           | Entidades, relações, decisões de modelagem, índices               |
| [04 — Design System](04-design-system.md)               | Tema orbital, tokens, customização por usuário, motion            |
| [05 — Roadmap](05-roadmap.md)                           | Fases de execução, ordem de implementação, critérios de pronto    |
| [06 — Fluxo de Trabalho](06-fluxo-de-trabalho.md)       | Branches, commits, PRs, CI, TDD e Clean Code                      |
| [07 — Autenticação](07-autenticacao.md)                 | Tokens, rotação, detecção de reúso, senhas e o que foi verificado |
| [08 — Recorrência](08-recorrencia.md)                   | Fuso horário, RRULE, expansão e as políticas de cada caso difícil |
| [09 — Agendas e Eventos](09-agendas-e-eventos.md)       | Matriz de permissões, dia inteiro, consulta por intervalo, rotas  |
| [10 — Tarefas](10-tarefas.md)                           | Ordenação fracionária, subtarefas de um nível, prazo e conclusão  |
| [11 — Visão de mês](11-visao-de-mes.md)                 | A grade, as barras de vários dias, e o e2e que passou a existir   |
| [12 — Formulário de evento](12-formulario-de-evento.md) | Criar e editar pela tela, e os seis defeitos que o e2e achou      |
| [13 — Semana e dia](13-visao-de-semana-e-dia.md)        | Grade de horas, linha de agora, eventos simultâneos lado a lado   |

## Estado atual

**Fase 2 em andamento.** Monorepo de pé, banco criado, autenticação de ponta a ponta, o
**motor de recorrência**, a **API inteira do núcleo** (agendas, membros, eventos com
recorrência, tarefas com ordenação manual) e a **primeira tela com dado de verdade**: a
visão de mês.

**Dá para usar**: três visões (mês, semana e dia), com linha de agora, e criar, editar e
excluir evento pela tela — inclusive as três operações de uma série recorrente. Falta da
Fase 2 a lista de próximos, o arrastar e a paleta de comandos. Da Fase 1, o perfil e a
recuperação de senha.

Ver o [roadmap](05-roadmap.md), a [autenticação](07-autenticacao.md), a
[recorrência](08-recorrencia.md), as [agendas e eventos](09-agendas-e-eventos.md), as
[tarefas](10-tarefas.md), a [visão de mês](11-visao-de-mes.md), o
[formulário de evento](12-formulario-de-evento.md) e as
[visões de semana e dia](13-visao-de-semana-e-dia.md).

Para abrir a aplicação com dados: `docker compose up -d && npm run db:seed`, depois
`npx nx run-many -t serve` e entrar com `enzo@norbit.dev` / `norbit123`.

```bash
docker compose up -d
npx nx run-many -t serve        # api em :3000, web em :4200
```

```
norbit/
├─ apps/
│  ├─ web/            Angular 22 + Tailwind 4
│  ├─ api/            NestJS 11
│  └─ web-e2e/        Playwright
├─ libs/
│  ├─ domain/         regras puras: recorrência, permissões, conflitos
│  ├─ contracts/      DTOs e schemas compartilhados
│  ├─ db/             Prisma Client e PrismaService — só a api alcança
│  └─ design-tokens/  tokens em TS, com o CSS derivado deles
├─ prisma/            schema, migration e seed
├─ tools/             gerador de tokens
└─ docs/              este planejamento
```

Comandos:

```bash
docker compose up -d           # Postgres, Redis, Adminer, Mailpit
npm install
npm run db:generate            # Prisma Client
npm run db:migrate             # aplica a migration
npm run db:seed                # dados de desenvolvimento
npm run tokens:build           # regera o CSS dos design tokens
npx nx run-many -t serve       # sobe web e api
npx nx affected -t lint test   # o que a sua mudança atingiu
```

Fora do versionamento, por decisão: `anthropic-model-router/` é ferramenta interna de
apoio ao desenvolvimento, não faz parte do produto, e está no `.gitignore`.

## Decisões já fechadas

- **Front-end:** Angular, com visual construído à mão em Tailwind + GSAP. React e Next
  estão descartados; os dois são runtimes concorrentes do Angular e não coexistem na
  mesma aplicação
- **Back-end:** NestJS, no mesmo monorepo
- **Banco:** PostgreSQL, rodando em Docker no ambiente local
- **Fluxo:** `feat/*` → `dev` (homologação) → `main` (produção), sempre via PR
- **Qualidade:** TDD obrigatório em `libs/domain` e em toda correção de bug; limites de
  Clean Code aplicados pelo ESLint, não por disciplina
- **Hospedagem:** decisão postergada deliberadamente; a arquitetura não depende dela
- **Mobile:** PWA instalável primeiro, Capacitor (APK Android / build iOS) depois

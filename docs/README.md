# Norbit — Documentação de Planejamento

Agenda compartilhada, bonita e customizável. Este diretório contém o planejamento
completo do projeto, decidido antes da primeira linha de código de produto.

## Índice

| Documento                                         | Conteúdo                                                          |
| ------------------------------------------------- | ----------------------------------------------------------------- |
| [01 — Visão e Escopo](01-visao-e-escopo.md)       | O que o Norbit é, para quem, o que entra no MVP e o que fica fora |
| [02 — Arquitetura](02-arquitetura.md)             | Stack, monorepo, camadas, Docker, autenticação, tempo real        |
| [03 — Modelo de Dados](03-modelo-de-dados.md)     | Entidades, relações, decisões de modelagem, índices               |
| [04 — Design System](04-design-system.md)         | Tema orbital, tokens, customização por usuário, motion            |
| [05 — Roadmap](05-roadmap.md)                     | Fases de execução, ordem de implementação, critérios de pronto    |
| [06 — Fluxo de Trabalho](06-fluxo-de-trabalho.md) | Branches, commits, PRs, CI, TDD e Clean Code                      |

## Estado atual

**Fase 1 em andamento.** O monorepo está de pé, o banco criado e o `PrismaService`
ligado à api. Ver o [roadmap](05-roadmap.md).

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

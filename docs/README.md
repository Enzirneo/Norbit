# Norbit — Documentação de Planejamento

Agenda compartilhada, bonita e customizável. Este diretório contém o planejamento
completo do projeto, decidido antes da primeira linha de código de produto.

## Índice

| Documento | Conteúdo |
|---|---|
| [01 — Visão e Escopo](01-visao-e-escopo.md) | O que o Norbit é, para quem, o que entra no MVP e o que fica fora |
| [02 — Arquitetura](02-arquitetura.md) | Stack, monorepo, camadas, Docker, autenticação, tempo real |
| [03 — Modelo de Dados](03-modelo-de-dados.md) | Entidades, relações, decisões de modelagem, índices |
| [04 — Design System](04-design-system.md) | Tema orbital, tokens, customização por usuário, motion |
| [05 — Roadmap](05-roadmap.md) | Fases de execução, ordem de implementação, critérios de pronto |
| [06 — Fluxo de Trabalho](06-fluxo-de-trabalho.md) | Branches, commits, PRs, CI, TDD e Clean Code |

## Estado atual

Nada de produto foi implementado ainda. O repositório contém:

- `docs/` — este planejamento
- `prisma/schema.prisma` — o esquema do banco, validado com `prisma validate`
- `prisma/migrations/` — a migration inicial em SQL, pronta para aplicar
- `prisma.config.ts` — configuração do Prisma 7 (onde a URL do banco agora vive)
- `docker-compose.yml` — Postgres, Redis, Adminer e Mailpit, validado com
  `docker compose config`
- `.env.example` — todas as variáveis de ambiente previstas
- `.github/workflows/ci.yml` — pipeline de lint, teste, build e E2E
- `.github/pull_request_template.md` — checklist de PR
- `commitlint.config.js` — validação das mensagens de commit
Fora do versionamento, por decisão: `anthropic-model-router/` é ferramenta interna de
apoio ao desenvolvimento, não faz parte do produto, e está no `.gitignore`. Ele existe
na sua máquina mas não vai para o repositório remoto.

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

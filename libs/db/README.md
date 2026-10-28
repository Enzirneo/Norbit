# @norbit/db

O acesso ao banco, e o único lugar do monorepo onde o Prisma entra.

## O que tem aqui

| Arquivo                     | Papel                                                 |
| --------------------------- | ----------------------------------------------------- |
| `src/generated/`            | Prisma Client, **gerado** — fora do git, fora do lint |
| `src/lib/prisma.service.ts` | O client como provider do Nest, com ciclo de vida     |
| `src/lib/prisma.module.ts`  | Módulo `@Global()`, importado uma vez no `AppModule`  |

## Antes de qualquer coisa

```bash
npm run db:generate
```

Sem isso a lib não compila: `src/generated/` não está versionado. Código gerado em git
viraria conflito de merge a cada alteração do schema e ficaria desatualizado em
silêncio. O CI roda este comando logo depois do `npm ci`, em todos os jobs.

## Quem pode importar

Só a `api`. A fronteira é aplicada pelo ESLint (`scope:api` → `scope:db`), e foi
verificada com imports plantados de propósito em `web` e em `domain` — os dois
rejeitados. O navegador nunca recebe credenciais de banco, e `libs/domain` continua
testável sem Postgres.

Tipos e enums vêm daqui por `@norbit/db`, nunca por um caminho `generated/` relativo:

```ts
import { PrismaService, type User, CalendarRole } from '@norbit/db';
```

## Testes

O teste do `PrismaService` é de **integração**, contra o Postgres do `docker compose`.
Um mock ali testaria o mock: não provaria que o driver adapter que o Prisma 7 passou a
exigir está ligado de verdade, que é justamente a parte difícil.

```bash
docker compose up -d
npx nx test db
```

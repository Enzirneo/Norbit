// Configuração do Prisma (obrigatória desde o Prisma 7, que removeu a URL de
// conexão do schema.prisma). Ver docs/03-modelo-de-dados.md.
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});

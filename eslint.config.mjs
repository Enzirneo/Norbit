import nx from '@nx/eslint-plugin';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    // O client do Prisma é gerado: não se revisa, não se formata e não cabe
    // nos limites de Clean Code (são milhares de linhas por arquivo).
    ignores: [
      '**/dist',
      '**/out-tsc',
      '**/vitest.config.*.timestamp*',
      'libs/db/src/generated/**',
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      // Fronteiras entre camadas. É o que garante, meses adiante, que
      // libs/domain continue puro e testável sem banco: sem esta regra, um dia
      // alguém importa o PrismaService lá dentro "só para resolver rápido".
      // Ver docs/06-fluxo-de-trabalho.md.
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
          depConstraints: [
            // O domínio não conhece ninguém: nem Angular, nem Nest, nem Prisma.
            {
              sourceTag: 'scope:domain',
              onlyDependOnLibsWithTags: ['scope:domain'],
              // onlyDependOnLibsWithTags governa apenas libs do workspace; sem
              // bannedExternalImports, nada impediria `import { PrismaClient }
              // from '@prisma/client'` aqui dentro, e a lib deixaria de ser
              // testável sem banco.
              bannedExternalImports: [
                '@prisma/*',
                'prisma',
                '@angular/*',
                '@nestjs/*',
                'express',
                'pg',
                'ioredis',
                'bullmq',
              ],
            },
            // Contratos são só tipos e schemas Zod.
            {
              sourceTag: 'scope:contracts',
              onlyDependOnLibsWithTags: ['scope:contracts'],
              bannedExternalImports: [
                '@prisma/*',
                '@angular/*',
                '@nestjs/*',
                'express',
              ],
            },
            // Tokens de design não dependem de nada.
            {
              sourceTag: 'scope:design-tokens',
              onlyDependOnLibsWithTags: ['scope:design-tokens'],
              bannedExternalImports: ['@angular/*', '@nestjs/*', '@prisma/*'],
            },
            // A @norbit/db é o único lugar do monorepo onde o Prisma entra.
            // Ela não conhece o domínio: é infraestrutura, e a dependência
            // corre no sentido oposto.
            {
              sourceTag: 'scope:db',
              onlyDependOnLibsWithTags: ['scope:contracts'],
              bannedExternalImports: ['@angular/*'],
            },
            {
              sourceTag: 'scope:api',
              onlyDependOnLibsWithTags: [
                'scope:domain',
                'scope:contracts',
                'scope:db',
              ],
              bannedExternalImports: ['@angular/*'],
            },
            {
              sourceTag: 'scope:web',
              onlyDependOnLibsWithTags: [
                'scope:domain',
                'scope:contracts',
                'scope:design-tokens',
                'scope:ui',
              ],
              // O navegador não fala com o banco: credenciais e SQL nunca saem
              // do servidor.
              bannedExternalImports: [
                '@prisma/*',
                'prisma',
                '@nestjs/*',
                'pg',
                'ioredis',
              ],
            },
            // O E2E exercita a aplicação de fora; pode olhar o que precisar.
            { sourceTag: 'scope:e2e', onlyDependOnLibsWithTags: ['*'] },
          ],
        },
      ],
    },
  },
  {
    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.cts',
      '**/*.mts',
      '**/*.js',
      '**/*.jsx',
      '**/*.cjs',
      '**/*.mjs',
    ],
    // Limites de Clean Code. Princípio vira discussão; limite vira CI.
    // Ver docs/06-fluxo-de-trabalho.md#clean-code.
    rules: {
      complexity: ['error', 10], // ramificação demais: extraia
      'max-depth': ['error', 3], // 4 níveis de if aninhado: repense
      'max-lines-per-function': [
        'error',
        { max: 50, skipBlankLines: true, skipComments: true },
      ],
      'max-lines': [
        'error',
        { max: 400, skipBlankLines: true, skipComments: true },
      ],
      'max-params': ['error', 4], // mais que isso: passe um objeto
      'no-console': 'error',
      'no-debugger': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'prefer-const': 'error',
      'no-var': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    // Regras que exigem o tipo, não só a sintaxe. O `projectService` faz o
    // ESLint subir o mesmo serviço de linguagem do TypeScript, então ele sabe
    // que `salvar()` devolve uma Promise e pode cobrar o `await`.
    //
    // Restrito a `src/` de propósito: arquivos soltos de configuração e de
    // script não pertencem a nenhum tsconfig, e incluí-los faria o lint falhar
    // por projeto não encontrado em vez de por defeito.
    //
    // O padrão começa com `**/` porque o alvo de lint do Nx roda `eslint .` com
    // o cwd no projeto, e então o ESLint resolve os padrões a partir do
    // eslint.config.mjs do projeto, não da raiz. Um glob `libs/*/src/**` casa
    // quando rodado da raiz e não casa quando rodado pelo Nx, o que faz as
    // regras sumirem em silêncio.
    files: ['**/src/**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // O defeito que esta regra pega é silencioso: uma Promise sem `await`
      // faz o erro virar unhandled rejection e a operacao parecer bem-sucedida.
      // Numa API de agenda isso significa responder 200 para um evento que
      // nunca foi gravado.
      '@typescript-eslint/no-floating-promises': 'error',
      // Promise onde se espera booleano: um `if (verificaSenha(...))` sem
      // await é sempre verdadeiro, porque toda Promise é truthy.
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/require-await': 'error',
      // Assinatura explícita no que é exportado: o contorno da função passa a
      // ser decisão, e não consequência do corpo dela.
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        { allowExpressions: true, allowTypedFunctionExpressions: true },
      ],
    },
  },
  {
    // Testes descrevem casos, então são naturalmente longos: um `describe` com
    // 30 cenários é bom teste, não função grande. Os outros limites continuam.
    files: [
      '**/*.spec.ts',
      '**/*.test.ts',
      '**/*.spec.tsx',
      '**/*.e2e-spec.ts',
    ],
    rules: {
      'max-lines-per-function': 'off',
      'max-lines': 'off',
    },
  },
  {
    // O bootstrap é o único ponto sem aplicação de pé para receber o erro: se o
    // Angular não subir, o console é o que resta.
    files: ['**/src/main.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    // Arquivos de configuração usam o que a ferramenta exige.
    files: [
      '**/*.config.{js,cjs,mjs,ts,cts,mts}',
      '**/jest.preset.js',
      'prisma/seed.ts',
    ],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
];

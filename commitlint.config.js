// Valida a mensagem de commit no hook `commit-msg`.
// Ver docs/06-fluxo-de-trabalho.md. Ativado na Fase 0 com:
//   npm i -D @commitlint/cli @commitlint/config-conventional husky
//   npx husky init && echo 'npx commitlint --edit $1' > .husky/commit-msg

module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'refactor', 'test', 'docs', 'chore', 'perf', 'style', 'revert'],
    ],
    'scope-enum': [
      2,
      'always',
      [
        'auth',
        'calendar',
        'events',
        'tasks',
        'sharing',
        'notifications',
        'settings',
        'ui',
        'domain',
        'contracts',
        'db',
        'ci',
        'deps',
        'release',
      ],
    ],
    // Escopo não é obrigatório, mas quando existe precisa ser um dos acima.
    'scope-empty': [0],
    'subject-case': [2, 'always', 'lower-case'],
    'subject-full-stop': [2, 'never', '.'],
    'header-max-length': [2, 'always', 72],
    'body-max-line-length': [2, 'always', 100],
  },
};

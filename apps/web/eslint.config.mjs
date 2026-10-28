import nx from '@nx/eslint-plugin';
import baseConfig from '../../eslint.config.mjs';

export default [
  ...nx.configs['flat/angular'],
  ...nx.configs['flat/angular-template'],
  ...baseConfig,
  {
    files: ['**/*.ts'],
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'nb',
          style: 'camelCase',
        },
      ],
      // `element` e `attribute`: o botão é `button[nb-botao]`, para herdar o
      // comportamento nativo do elemento — foco, `type="submit"`, Enter e
      // espaço. Um `<nb-botao>` embrulhando um `<button>` exigiria repassar
      // cada atributo à mão, e o primeiro esquecido vira defeito de
      // acessibilidade. É o mesmo desenho que o Angular Material usa.
      '@angular-eslint/component-selector': [
        'error',
        {
          type: ['element', 'attribute'],
          prefix: 'nb',
          style: 'kebab-case',
        },
      ],
    },
  },
  {
    files: ['**/*.html'],
    rules: {},
  },
  {
    // O `<label>` do `nb-campo` envolve conteúdo **projetado**: a associação
    // com o controle é implícita pelo aninhamento, e correta no DOM final. A
    // regra não consegue ver o `<ng-content>`, então acusaria um problema que
    // não existe — e foi por isso que o controle ficou dentro do label, em vez
    // de depender de um `for`/`id` que alguém esqueceria de sincronizar.
    files: ['**/ui/campo.html'],
    rules: {
      '@angular-eslint/template/label-has-associated-control': 'off',
    },
  },
];

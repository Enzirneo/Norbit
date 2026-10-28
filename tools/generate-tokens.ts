/**
 * Gera o CSS dos tokens a partir da fonte TypeScript em libs/design-tokens.
 *
 * Existe para que os valores vivam em UM lugar só: o TS alimenta tanto o
 * código da aplicação quanto o CSS que o Tailwind e os componentes consomem.
 * Escrever as duas cópias à mão seria garantir que divergissem.
 *
 * Uso: npm run tokens:build
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  nebula,
  primitives,
  toCssVariables,
  type TemaSemantico,
} from '../libs/design-tokens/src';

const AVISO = [
  '/* ARQUIVO GERADO — NÃO EDITE À MÃO.',
  '   Fonte: libs/design-tokens/src/lib/{primitives,semanticos}.ts',
  '   Regerar: npm run tokens:build */',
].join('\n');

function recuar(bloco: string): string {
  return bloco
    .split('\n')
    .map((linha) => `  ${linha}`)
    .join('\n');
}

const camadaPrimitiva = primitives
  .map(({ prefix, tokens }) => recuar(toCssVariables(tokens, prefix)))
  .join('\n\n');

/**
 * Os semânticos saem com os nomes que o docs/04 especifica —
 * `--surface-base`, `--text-primary` — porque é esse o contrato: um componente
 * pode sempre escrever `var(--text-primary)`.
 */
const camadaSemantica = recuar(toCssVariables(nebula, 'nb'))
  // O prefixo serve só para o gerador não exigir string vazia; os nomes
  // publicados são os do documento.
  .replace(/--nb-/g, '--');

/**
 * E os mesmos semânticos entram no `@theme` do Tailwind com nomes escolhidos
 * para o utilitário ficar legível.
 *
 * Mapear `--text-primary` direto daria a classe `text-text-primary`. Aqui a
 * chave do Tailwind é `--color-primary`, e a classe fica `text-primary`.
 * Duas nomenclaturas com papéis diferentes: uma é o contrato do tema, a outra
 * é como se escreve no template.
 */
const PARA_TAILWIND: Record<string, keyof TemaSemantico> = {
  surface: 'surfaceBase',
  'surface-raised': 'surfaceRaised',
  'surface-overlay': 'surfaceOverlay',
  'surface-sunken': 'surfaceSunken',
  primary: 'textPrimary',
  secondary: 'textSecondary',
  muted: 'textMuted',
  'on-accent': 'textOnAccent',
  edge: 'borderDefault',
  'edge-subtle': 'borderSubtle',
  focus: 'borderFocus',
  accent: 'accent',
  'accent-hover': 'accentHover',
  'accent-muted': 'accentMuted',
  success: 'stateSuccess',
  warning: 'stateWarning',
  danger: 'stateDanger',
};

const VARIAVEL_SEMANTICA: Record<keyof TemaSemantico, string> = {
  surfaceBase: '--surface-base',
  surfaceRaised: '--surface-raised',
  surfaceOverlay: '--surface-overlay',
  surfaceSunken: '--surface-sunken',
  textPrimary: '--text-primary',
  textSecondary: '--text-secondary',
  textMuted: '--text-muted',
  textOnAccent: '--text-on-accent',
  borderSubtle: '--border-subtle',
  borderDefault: '--border-default',
  borderFocus: '--border-focus',
  accent: '--accent',
  accentHover: '--accent-hover',
  accentMuted: '--accent-muted',
  stateSuccess: '--state-success',
  stateWarning: '--state-warning',
  stateDanger: '--state-danger',
};

const utilitarios = Object.entries(PARA_TAILWIND)
  .map(
    ([classe, token]) =>
      `  --color-${classe}: var(${VARIAVEL_SEMANTICA[token]});`,
  )
  .join('\n');

const css = [
  AVISO,
  '',
  '/* Camada 1 — primitivos. Nenhum componente deve usá-los direto. */',
  '@theme {',
  camadaPrimitiva,
  '',
  '/* Camada 2, para o Tailwind gerar utilitários legíveis a partir dos',
  '   semânticos: bg-surface, text-muted, border-edge, bg-accent. */',
  utilitarios,
  '}',
  '',
  '/* Camada 2 — semânticos, com os nomes do docs/04. Trocar de preset',
  '   redefine este bloco e nenhum componente é tocado. */',
  ':root {',
  camadaSemantica,
  '}',
  '',
].join('\n');

const destino = join(
  process.cwd(),
  'apps',
  'web',
  'src',
  'tokens.generated.css',
);
writeFileSync(destino, css, 'utf8');
console.log(`tokens gerados: ${destino}`);

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
  FORMA_DERIVADA,
  FORMA_PADRAO,
  TEMAS_PRONTOS,
  VARIAVEIS_SEMANTICAS,
  derivar,
  primitives,
  tokensDeForma,
  toCssVariables,
  type TemaSemantico,
} from '../libs/design-tokens/src';

const AVISO = [
  '/* ARQUIVO GERADO — NÃO EDITE À MÃO.',
  '   Fonte: libs/design-tokens/src/lib/{primitives,semanticos,forma}.ts',
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
const camadaSemantica = recuar(
  toCssVariables(derivar(TEMAS_PRONTOS.nebula).tokens, 'nb'),
)
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

const utilitarios = Object.entries(PARA_TAILWIND)
  .map(
    ([classe, token]) =>
      `  --color-${classe}: var(${VARIAVEIS_SEMANTICAS[token]});`,
  )
  .join('\n');

/**
 * A camada de forma: as escolhas da pessoa (`--r`, `--estrelas`) com o valor
 * padrão, e o que deriva delas. As escolhas vêm primeiro porque os derivados as
 * leem; o navegador resolve `var()` na hora de usar, então a ordem é só leitura.
 */
function declaracoes(tokens: Record<string, string>): string {
  return Object.entries(tokens)
    .map(([nome, valor]) => `  ${nome}: ${valor};`)
    .join('\n');
}

const camadaDeForma = [
  declaracoes(tokensDeForma(FORMA_PADRAO)),
  declaracoes(FORMA_DERIVADA),
].join('\n');

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
  '/* Camada de forma — cantos, sombras, vidro, brilho, estrelas e alvo de toque.',
  '   `--r` e `--estrelas` são escolha da pessoa; o resto deriva. Ver',
  '   docs/superpowers/specs/2026-11-19-design-system-design.md, seção 4.1. */',
  ':root {',
  camadaDeForma,
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

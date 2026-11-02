/**
 * Primitivos: a paleta base do Norbit. Não são usados diretamente pelos
 * componentes — a camada semântica (Fase 4) os referencia, e é ela que os
 * componentes consomem. Ver docs/04-design-system.md.
 *
 * **Hexadecimal sempre minúsculo.** A cor é comparada como texto no banco — há
 * CHECK constraint exigindo isso desde `20261029024149_cores_em_minusculo` — e
 * o contrato `corHex` normaliza a entrada. Com os primitivos em maiúsculas, a
 * paleta de acentos nunca casava com a cor normalizada que chegava do
 * formulário, e a validação recusava uma cor que ela mesma oferecia.
 */

import type { TokenSet } from './css-variables';

/** Espaço profundo: fundos e superfícies dos temas escuros. */
export const space = {
  space900: '#070812',
  space800: '#0b0d17',
  space700: '#13162a',
  space600: '#1c2038',
  space500: '#2a2f4a',
} as const satisfies TokenSet;

/** Poeira estelar: neutros frios, para texto e bordas. */
export const dust = {
  dust400: '#4a5070',
  dust300: '#6e7595',
  dust200: '#9aa0bc',
  dust100: '#c9cde0',
  dust000: '#f4f5fa',
} as const satisfies TokenSet;

/** Acentos orbitais. `nebula` é o padrão; o usuário pode escolher o seu. */
export const accent = {
  nebula: '#6d7cff',
  aurora: '#4adebb',
  solar: '#ffb357',
  pulsar: '#ff6b8a',
  cosmos: '#a97bff',
} as const satisfies TokenSet;

/**
 * Escala de espaçamento. Os valores levam unidade porque o destino é CSS: uma
 * transição com `240` em vez de `240ms` é simplesmente ignorada pelo navegador.
 * A densidade escolhida pelo usuário multiplica a
 * unidade base; nenhum componente conhece a densidade, todos leem a variável.
 */
export const spacing = {
  unit: '4px',
  rowHeightCompact: '28px',
  rowHeightComfortable: '36px',
  rowHeightSpacious: '44px',
} as const satisfies TokenSet;

/** Durações de transição. Ver docs/04-design-system.md#motion. */
export const duration = {
  instant: '100ms',
  quick: '180ms',
  base: '240ms',
  slow: '320ms',
} as const satisfies TokenSet;

/** Curvas de easing. `orbit` é a assinatura: entrada em arco, não em linha. */
export const easing = {
  orbit: 'cubic-bezier(0.34, 1.26, 0.64, 1)',
  settle: 'cubic-bezier(0.22, 1, 0.36, 1)',
} as const satisfies TokenSet;

/** Todas as camadas, com o prefixo CSS de cada uma. */
export const primitives = [
  { prefix: 'color', tokens: { ...space, ...dust, ...accent } },
  { prefix: 'space', tokens: spacing },
  { prefix: 'duration', tokens: duration },
  { prefix: 'ease', tokens: easing },
] as const satisfies readonly { prefix: string; tokens: TokenSet }[];

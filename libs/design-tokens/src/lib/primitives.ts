/**
 * Primitivos: a paleta base do Norbit. Não são usados diretamente pelos
 * componentes — a camada semântica (Fase 4) os referencia, e é ela que os
 * componentes consomem. Ver docs/04-design-system.md.
 */

import type { TokenSet } from './css-variables';

/** Espaço profundo: fundos e superfícies dos temas escuros. */
export const space = {
  space900: '#070812',
  space800: '#0B0D17',
  space700: '#13162A',
  space600: '#1C2038',
  space500: '#2A2F4A',
} as const satisfies TokenSet;

/** Poeira estelar: neutros frios, para texto e bordas. */
export const dust = {
  dust400: '#4A5070',
  dust300: '#6E7595',
  dust200: '#9AA0BC',
  dust100: '#C9CDE0',
  dust000: '#F4F5FA',
} as const satisfies TokenSet;

/** Acentos orbitais. `nebula` é o padrão; o usuário pode escolher o seu. */
export const accent = {
  nebula: '#6D7CFF',
  aurora: '#4ADEBB',
  solar: '#FFB357',
  pulsar: '#FF6B8A',
  cosmos: '#A97BFF',
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

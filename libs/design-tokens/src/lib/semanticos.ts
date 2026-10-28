/**
 * Camada semântica: a única que os componentes consomem.
 *
 * Nenhum componente conhece `space-800` ou `nebula`. Eles pedem
 * `--surface-base` e `--accent`, e é a troca de preset que redefine o que isso
 * significa. Sem esta camada, trocar de tema exigiria revisitar cada
 * componente — e aí não se troca mais. Ver docs/04-design-system.md.
 */
import { accent, dust, space } from './primitives';

export type TemaSemantico = {
  readonly surfaceBase: string;
  readonly surfaceRaised: string;
  readonly surfaceOverlay: string;
  readonly surfaceSunken: string;

  readonly textPrimary: string;
  readonly textSecondary: string;
  readonly textMuted: string;
  readonly textOnAccent: string;

  readonly borderSubtle: string;
  readonly borderDefault: string;
  readonly borderFocus: string;

  readonly accent: string;
  readonly accentHover: string;
  readonly accentMuted: string;

  readonly stateSuccess: string;
  readonly stateWarning: string;
  readonly stateDanger: string;
};

/** Usado pelo teste para garantir que nenhum preset esqueça um token. */
export const NOMES_SEMANTICOS = [
  'surfaceBase',
  'surfaceRaised',
  'surfaceOverlay',
  'surfaceSunken',
  'textPrimary',
  'textSecondary',
  'textMuted',
  'textOnAccent',
  'borderSubtle',
  'borderDefault',
  'borderFocus',
  'accent',
  'accentHover',
  'accentMuted',
  'stateSuccess',
  'stateWarning',
  'stateDanger',
] as const satisfies readonly (keyof TemaSemantico)[];

/**
 * `nebula` — escuro azul-violeta, o padrão.
 *
 * Duas atribuições aqui saíram de medir, não de escolher:
 *
 * - **`borderDefault` é `dust300`, não `dust400`.** O `dust400` dá 2.47:1
 *   contra a superfície base e reprova o mínimo de 3:1 que um contorno de
 *   componente precisa. Curiosamente é o mesmo token que **não** serve para
 *   texto (4.28:1): bom para borda, ruim para letra.
 * - **`textOnAccent` é `space900`, não `dust000`.** Texto claro sobre o acento
 *   dá 3.23:1 e reprova; texto escuro dá 5.68:1. Botão de acento leva letra
 *   escura, mesmo que o instinto diga o contrário.
 */
export const nebula: TemaSemantico = {
  surfaceBase: space.space800,
  surfaceRaised: space.space700,
  surfaceOverlay: space.space600,
  surfaceSunken: space.space900,

  textPrimary: dust.dust000,
  textSecondary: dust.dust100,
  textMuted: dust.dust200,
  textOnAccent: space.space900,

  // Divisor decorativo: não delimita componente, então não tem piso de 3:1.
  borderSubtle: space.space600,
  borderDefault: dust.dust300,
  borderFocus: accent.nebula,

  accent: accent.nebula,
  // Clareado à mão por enquanto. A derivação em OKLCH, que mantém o contraste
  // correto para qualquer acento que o usuário escolher, é a Fase 4.
  accentHover: '#8793FF',
  // Fundo de estado selecionado: escuro o suficiente para texto primário ficar
  // em cima, então não entra nos pares de contraste como frente.
  accentMuted: '#1F2547',

  stateSuccess: accent.aurora,
  stateWarning: accent.solar,
  stateDanger: accent.pulsar,
};

/**
 * Os presets disponíveis.
 *
 * Só `nebula` por agora. `eclipse`, `dawn` e `vacuum` são a Fase 4 — e cada um
 * vai ter de passar pelo mesmo teste de contraste, que é o ponto de ele existir
 * antes dos temas.
 */
export const presets = { nebula } as const;

export type NomeDePreset = keyof typeof presets;

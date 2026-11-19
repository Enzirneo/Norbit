/**
 * O tema da pessoa, como é guardado e trafega: sementes de cor e a forma.
 *
 * É o `UserSettings.appearance`, um JSON versionado (`v`). As cores são só
 * **sementes**; tudo o mais se deriva no cliente (`derivar`, em
 * `libs/design-tokens`), então o que viaja e o que se guarda é pequeno e nunca
 * incoerente.
 *
 * `ajustes` (ajuste fino de cor) está **reservado**: o `strip` o descarta na
 * v1, e quando existir entra numa versão nova sem quebrar quem já guardou.
 */
import {
  CANTOS_MAXIMO,
  CANTOS_MINIMO,
  FORMA_PADRAO,
  TEMAS_PRONTOS,
  type NomeDeTemaPronto,
} from '@norbit/design-tokens';
import { z } from 'zod';
import { corHex } from '../agendas/comum';

const NOMES_DE_TEMA = Object.keys(TEMAS_PRONTOS) as [
  NomeDeTemaPronto,
  ...NomeDeTemaPronto[],
];

export const temaSchema = z
  .object({
    v: z.literal(1),
    /** De qual tema pronto a pessoa partiu; `null` se editou as sementes. */
    base: z.enum(NOMES_DE_TEMA).nullable(),
    sementes: z.object({
      fundo: corHex,
      destaque: corHex,
      contraste: z.enum(['normal', 'alto']),
    }),
    forma: z.object({
      cantos: z.number().int().min(CANTOS_MINIMO).max(CANTOS_MAXIMO),
      estrelas: z.boolean(),
      lua: z.boolean(),
      hemisferio: z.enum(['sul', 'norte']),
    }),
  })
  .strip();

export type Tema = z.infer<typeof temaSchema>;

export const TEMA_PADRAO: Tema = {
  v: 1,
  base: 'nebula',
  sementes: { ...TEMAS_PRONTOS.nebula },
  forma: {
    cantos: FORMA_PADRAO.cantos,
    estrelas: FORMA_PADRAO.estrelas,
    lua: true,
    hemisferio: 'sul',
  },
};

/**
 * O tema de uma conta que ainda só tem o par antigo (`themePreset` e
 * `accentColor`): a migração faz isto em SQL, e a API, para contas sem o JSON.
 *
 * Um preset que não conhecemos cai no nebula: o campo era texto livre, e o que
 * importa é a pessoa continuar com um tema válido.
 */
export function temaLegado(preset: string, destaque: string): Tema {
  const base: NomeDeTemaPronto =
    preset in TEMAS_PRONTOS ? (preset as NomeDeTemaPronto) : 'nebula';

  return {
    ...TEMA_PADRAO,
    base,
    sementes: {
      fundo: TEMAS_PRONTOS[base].fundo,
      destaque,
      contraste: 'normal',
    },
  };
}

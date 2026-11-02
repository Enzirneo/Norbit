/**
 * Contratos das preferências do usuário.
 *
 * `UserSettings` existe no banco desde a primeira migration e não era exposto:
 * a tela abria sempre no mês, a semana começava sempre no domingo, e esconder
 * uma agenda era esquecido ao recarregar. Isto é a ponte.
 */
import { VALORES_DE_ACENTO } from '@norbit/design-tokens';
import { z } from 'zod';
import { corHex } from '../agendas/comum';

/**
 * A cor de destaque, restrita à paleta que o produto oferece.
 *
 * Não é um seletor livre, e a razão é de acessibilidade: `accentHover`,
 * `accentMuted` e a cor do texto em cima são **derivadas** do acento, e derivar
 * com garantia de contraste para o espectro inteiro exige trabalhar em claridade
 * perceptual (OKLCH). Até lá, cada acento oferecido passa pelo teste de
 * contraste em `libs/design-tokens` — que reprova a build.
 *
 * A lista vem de lá, e não escrita à mão aqui: acrescentar um acento na paleta
 * passaria a ser recusado por este contrato.
 */
const acento = corHex.refine(
  (cor) => VALORES_DE_ACENTO.includes(cor),
  'Essa cor de destaque não está entre as oferecidas.',
);

/**
 * A densidade: 0 compacta, 1 confortável, 2 espaçosa.
 *
 * Um inteiro e não um enum de texto porque é uma **escala**, e o CSS a usa como
 * índice de altura de linha. Nomear "compacta" obrigaria a traduzir de volta
 * para um número em algum lugar.
 */
const densidade = z.number().int().min(0).max(2);

/** 0 = domingo … 6 = sábado, como `UserSettings.weekStartsOn`. */
const inicioDaSemana = z.number().int().min(0).max(6);

export const atualizarPreferenciasSchema = z
  .object({
    accentColor: acento,
    density: densidade,
    reducedMotion: z.boolean(),
    defaultView: z.enum(['MONTH', 'WEEK', 'DAY', 'AGENDA']),
    weekStartsOn: inicioDaSemana,
    use24Hour: z.boolean(),
  })
  .partial()
  .strip()
  .refine(
    (dados) => Object.keys(dados).length > 0,
    'Informe ao menos uma preferência para alterar.',
  );

export type AtualizarPreferencias = z.infer<typeof atualizarPreferenciasSchema>;

/**
 * O que a API devolve.
 *
 * Só o que a interface usa hoje. `theme`, `themePreset` e os campos de
 * notificação ficam de fora de propósito: devolver um campo que nada lê convida
 * a construir contra ele antes de a funcionalidade existir.
 */
export type PreferenciasVisiveis = {
  readonly accentColor: string;
  readonly density: number;
  readonly reducedMotion: boolean;
  readonly defaultView: 'MONTH' | 'WEEK' | 'DAY' | 'AGENDA';
  readonly weekStartsOn: number;
  readonly use24Hour: boolean;
};

/**
 * As preferências de **um membro** sobre **uma agenda**.
 *
 * Separadas das preferências da conta porque são por agenda, e separadas da
 * alteração da agenda porque aquela é do dono: esconder uma agenda das próprias
 * visões não deveria exigir ser dono dela.
 */
export const preferenciasDaAgendaSchema = z
  .object({
    isHidden: z.boolean(),
    /** A cor com que **este** membro vê a agenda, sem alterar a dos outros. */
    colorOverride: corHex.nullable(),
  })
  .partial()
  .strip()
  .refine(
    (dados) => Object.keys(dados).length > 0,
    'Informe ao menos uma preferência para alterar.',
  );

export type PreferenciasDaAgenda = z.infer<typeof preferenciasDaAgendaSchema>;

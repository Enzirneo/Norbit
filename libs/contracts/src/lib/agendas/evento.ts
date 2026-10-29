/**
 * Contratos de entrada dos eventos.
 *
 * A regra de recorrência **não** é validada aqui: quem sabe ler RRULE é
 * `libs/domain`, e `libs/contracts` não pode depender dela (ver as fronteiras
 * em `eslint.config.mjs`). Aqui ela é só texto com teto de tamanho; o serviço
 * a passa por `lerRrule`, que recusa o que não implementa, e a recusa volta
 * como 400 com a mensagem da própria regra.
 */
import { z } from 'zod';
import { corHex, fusoIana, instante } from './comum';

/** Teto do texto da RRULE. Uma regra legítima não passa de uns 200 caracteres. */
const TAMANHO_MAXIMO_DE_REGRA = 500;

const campos = {
  title: z.string().trim().min(1, 'O evento precisa de um título.').max(200),
  description: z.string().trim().max(2000).nullable(),
  location: z.string().trim().max(300).nullable(),
  /** Sobrescreve a cor da agenda só para este evento. */
  color: corHex.nullable(),
  startsAt: instante,
  endsAt: instante,
  isAllDay: z.boolean(),
  timeZone: fusoIana,
  status: z.enum(['CONFIRMED', 'TENTATIVE', 'CANCELLED']),
  visibility: z.enum(['INHERITED', 'PRIVATE']),
  recurrenceRule: z.string().trim().max(TAMANHO_MAXIMO_DE_REGRA).nullable(),
};

/**
 * O fim nunca vem antes do início.
 *
 * Espelha de propósito a CHECK constraint do Postgres (ver o fim de
 * `prisma/schema.prisma`): o banco é a garantia, isto é a mensagem decente. Sem
 * o schema, a violação chegaria como erro 500 de constraint.
 *
 * `>=` e não `>`: um evento de duração zero é um marco no tempo ("entrega do
 * relatório"), e recusá-lo não ajudaria ninguém.
 */
function fimDepoisDoInicio(dados: { startsAt?: Date; endsAt?: Date }): boolean {
  if (!dados.startsAt || !dados.endsAt) {
    return true;
  }

  return dados.endsAt.getTime() >= dados.startsAt.getTime();
}

/**
 * Sem `as const`: o Zod declara `path` como array mutável, e um literal
 * `readonly` não é atribuível a ele. O `vitest` não reclamaria — ele não checa
 * tipos — e o erro só apareceria no `tsc` do build.
 */
const MENSAGEM_DE_ORDEM = {
  message: 'O fim do evento não pode vir antes do início.',
  path: ['endsAt'],
};

export const criarEventoSchema = z
  .object({
    ...campos,
    description: campos.description.optional(),
    location: campos.location.optional(),
    color: campos.color.optional(),
    isAllDay: campos.isAllDay.default(false),
    status: campos.status.default('CONFIRMED'),
    visibility: campos.visibility.default('INHERITED'),
    recurrenceRule: campos.recurrenceRule.optional(),
    // Ausente herda o fuso da agenda, decidido no serviço.
    timeZone: campos.timeZone.optional(),
  })
  .strip()
  .refine(fimDepoisDoInicio, MENSAGEM_DE_ORDEM);

/**
 * A atualização aceita subconjunto, e aí a verificação de ordem fica incompleta
 * por natureza: um PATCH que move só o `endsAt` para antes do `startsAt`
 * guardado passa por aqui. Quem completa é o serviço, que compara contra a
 * linha existente — e a CHECK do banco atrás dele.
 */
export const atualizarEventoSchema = z
  .object(campos)
  .partial()
  .strip()
  .refine(
    (dados) => Object.keys(dados).length > 0,
    'Informe ao menos um campo para alterar.',
  )
  .refine(fimDepoisDoInicio, MENSAGEM_DE_ORDEM);

export type CriarEvento = z.infer<typeof criarEventoSchema>;
export type AtualizarEvento = z.infer<typeof atualizarEventoSchema>;

/**
 * Teto do intervalo consultado, em dias.
 *
 * A visão mais longa do produto é um ano; 400 dias dão folga para as bordas de
 * fuso e para um "ano que vem" começando hoje. Sem teto, uma consulta de mil
 * anos faria a expansão de recorrência estourar o limite dela e devolver erro —
 * melhor recusar na entrada, com uma mensagem que diz o que fazer.
 */
export const LIMITE_DE_DIAS_CONSULTADOS = 400;

const MS_POR_DIA = 86_400_000;

export const consultaDeEventosSchema = z
  .object({
    de: instante,
    ate: instante,
    /**
     * Agendas a consultar, separadas por vírgula. Ausente significa "todas as
     * que eu vejo" — que é o caso normal de uma tela de calendário.
     */
    agendas: z
      .string()
      .optional()
      .transform((valor) =>
        valor
          ? valor
              .split(',')
              .map((id) => id.trim())
              .filter((id) => id !== '')
          : undefined,
      )
      .pipe(
        z.array(z.uuid('Identificador de agenda inválido.')).max(50).optional(),
      ),
  })
  .strip()
  .refine((dados) => dados.ate.getTime() > dados.de.getTime(), {
    message: 'O fim do intervalo precisa vir depois do início.',
    path: ['ate'],
  })
  .refine(
    (dados) =>
      dados.ate.getTime() - dados.de.getTime() <=
      LIMITE_DE_DIAS_CONSULTADOS * MS_POR_DIA,
    {
      message: `O intervalo consultado não pode passar de ${LIMITE_DE_DIAS_CONSULTADOS} dias.`,
      path: ['ate'],
    },
  );

export type ConsultaDeEventos = z.infer<typeof consultaDeEventosSchema>;

/**
 * Um evento como ele está gravado.
 *
 * É o que as rotas de escrita devolvem: a linha, não as ocorrências. Quem cria
 * uma série semanal recebe a série, e não 52 repetições dela.
 *
 * As datas saem como ISO-8601 com `Z`. Texto, e não `Date`, porque é o que
 * atravessa JSON sem perder informação — e porque o cliente precisa do fuso do
 * **evento** (`timeZone`) para renderizar, não do fuso de quem está lendo.
 */
export type EventoVisivel = {
  readonly id: string;
  readonly calendarId: string;
  readonly title: string;
  readonly description: string | null;
  readonly location: string | null;
  readonly color: string | null;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly isAllDay: boolean;
  readonly timeZone: string;
  readonly status: 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED';
  readonly visibility: 'INHERITED' | 'PRIVATE';
  readonly recurrenceRule: string | null;
  /** Preenchidos quando este evento é uma ocorrência destacada de uma série. */
  readonly recurrenceParentId: string | null;
  readonly originalStartsAt: string | null;
  /** As ocorrências removidas da série, o "excluir só este". */
  readonly excludedDates: readonly string[];
  readonly createdById: string;
};

/**
 * O instante que identifica uma ocorrência dentro da série.
 *
 * `inicioOriginal` é a identidade dela — ver `docs/08-recorrencia.md`. Vem como
 * parâmetro de rota nas operações de "só este".
 */
export const ocorrenciaSchema = z.object({ inicioOriginal: instante }).strip();

export type AlvoDeOcorrencia = z.infer<typeof ocorrenciaSchema>;

/**
 * Uma ocorrência como a interface a recebe.
 *
 * Série recorrente não vira linha no banco: a API expande a regra no intervalo
 * pedido (ver `docs/08-recorrencia.md`) e devolve ocorrências. `inicioOriginal`
 * é a identidade da instância dentro da série — é por ele que "editar só este"
 * se refere a ela.
 */
export type OcorrenciaVisivel = {
  readonly id: string;
  readonly calendarId: string;
  readonly title: string;
  readonly description: string | null;
  readonly location: string | null;
  readonly color: string | null;
  readonly inicio: string;
  readonly fim: string;
  readonly inicioOriginal: string;
  readonly isAllDay: boolean;
  readonly timeZone: string;
  readonly status: 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED';
  readonly ehRecorrente: boolean;
  readonly createdById: string;
};

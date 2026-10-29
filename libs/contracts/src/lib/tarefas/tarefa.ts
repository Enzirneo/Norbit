/**
 * Contratos de entrada das tarefas.
 *
 * Como nos outros, os schemas vivem aqui para que o formulário do Angular valide
 * com exatamente a mesma regra que a API aplica.
 */
import { z } from 'zod';
import { instante } from '../agendas/comum';

/**
 * Os campos, uma vez, sem valor padrão — a mesma razão de `agenda.ts`: o padrão
 * no schema compartilhado faria um PATCH só com o título reescrever a prioridade.
 */
const campos = {
  title: z.string().trim().min(1, 'A tarefa precisa de um título.').max(200),
  notes: z.string().trim().max(5000).nullable(),
  priority: z.enum(['NONE', 'LOW', 'MEDIUM', 'HIGH']),
  /**
   * O prazo.
   *
   * Com `isDueAllDay`, o servidor normaliza para o **fim exclusivo** do dia no
   * fuso da agenda — ver `libs/domain/src/lib/agendas/dia-inteiro.ts`. É o que
   * faz "está atrasada" ser `dueAt <= agora`, sem ajuste nenhum. Para exibir a
   * data, use o dia local de `dueAt - 1ms`.
   */
  dueAt: instante.nullable(),
  isDueAllDay: z.boolean(),
  visibility: z.enum(['INHERITED', 'PRIVATE']),
  /** Quem é responsável. `null` é "ninguém ainda", que é diferente de "eu". */
  assigneeId: z.uuid('Identificador de responsável inválido.').nullable(),
  /**
   * A tarefa-mãe, quando esta é uma subtarefa.
   *
   * Um nível só: subtarefa de subtarefa é recusada pelo serviço. O banco aceita
   * profundidade qualquer, e aceitar também significaria construir uma interface
   * de árvore — e abrir espaço para ciclo. Com um nível, a mãe é por definição
   * uma tarefa sem mãe, e o ciclo fica impossível por construção.
   */
  parentTaskId: z.uuid('Identificador de tarefa-mãe inválido.').nullable(),
};

export const criarTarefaSchema = z
  .object({
    ...campos,
    notes: campos.notes.optional(),
    dueAt: campos.dueAt.optional(),
    assigneeId: campos.assigneeId.optional(),
    parentTaskId: campos.parentTaskId.optional(),
    priority: campos.priority.default('NONE'),
    isDueAllDay: campos.isDueAllDay.default(false),
    visibility: campos.visibility.default('INHERITED'),
  })
  // Explícito porque é decisão de segurança: `createdById`, `position` e
  // `completedAt` no corpo nunca chegam ao serviço.
  .strip();

export const atualizarTarefaSchema = z
  .object({
    ...campos,
    /**
     * Concluir e reabrir.
     *
     * Booleano para fora, instante para dentro: a data de conclusão aparece no
     * histórico e alimenta o "concluída hoje", e o cliente não precisa
     * inventá-la — nem tem relógio confiável para isso.
     */
    concluida: z.boolean(),
  })
  .partial()
  .strip()
  .refine(
    (dados) => Object.keys(dados).length > 0,
    'Informe ao menos um campo para alterar.',
  );

export type CriarTarefa = z.infer<typeof criarTarefaSchema>;
export type AtualizarTarefa = z.infer<typeof atualizarTarefaSchema>;

/**
 * Para onde a tarefa foi arrastada, descrita pelos **vizinhos**.
 *
 * Não pela posição. A posição é fracionária e tem um limite de espaço (ver
 * `libs/domain/src/lib/tarefas/ordenacao.ts`); calculá-la no navegador espalharia
 * essa aritmética por cada cliente, e o primeiro que errasse gravaria duas
 * tarefas na mesma posição — defeito que aparece como "a lista muda de ordem
 * sozinha".
 *
 * `null` nos dois lados significa que a tarefa passa a ser a única da lista.
 */
export const moverTarefaSchema = z
  .object({
    anteriorId: z.uuid().nullable(),
    proximaId: z.uuid().nullable(),
  })
  .strip()
  .refine(
    (dados) =>
      dados.anteriorId === null ||
      dados.proximaId === null ||
      dados.anteriorId !== dados.proximaId,
    'Os dois vizinhos não podem ser a mesma tarefa.',
  );

export type MoverTarefa = z.infer<typeof moverTarefaSchema>;

export const consultaDeTarefasSchema = z
  .object({
    /** Agendas a consultar, separadas por vírgula. Ausente é "todas que eu vejo". */
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
    /**
     * Concluídas ficam de fora por padrão.
     *
     * É o que uma lista de tarefas mostra, e o padrão oposto faria a tela nascer
     * cheia de coisa resolvida.
     */
    incluirConcluidas: z
      .enum(['true', 'false'])
      .optional()
      .transform((valor) => valor === 'true'),
    responsavelId: z.uuid('Identificador de responsável inválido.').optional(),
  })
  .strip();

export type ConsultaDeTarefas = z.infer<typeof consultaDeTarefasSchema>;

/**
 * Uma tarefa como a API devolve.
 *
 * A lista vem **plana**, com `parentTaskId`, e não aninhada. Como a profundidade
 * é de um nível, agrupar no cliente é uma linha — e uma estrutura plana não
 * duplica a mãe em cada resposta nem obriga a inventar um formato novo quando a
 * tela quiser ordenar tudo por prazo, ignorando a hierarquia.
 *
 * **`position` só é comparável entre irmãs.** Cada mãe tem a numeração dela, e a
 * lista chega ordenada por posição sem separar os níveis — então uma subtarefa
 * pode vir no meio das tarefas principais. Renderizar na ordem recebida, sem
 * agrupar por `parentTaskId` primeiro, produz uma árvore embaralhada.
 */
export type TarefaVisivel = {
  readonly id: string;
  readonly calendarId: string;
  readonly title: string;
  readonly notes: string | null;
  readonly priority: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';
  readonly dueAt: string | null;
  readonly isDueAllDay: boolean;
  readonly completedAt: string | null;
  readonly visibility: 'INHERITED' | 'PRIVATE';
  readonly position: number;
  readonly parentTaskId: string | null;
  readonly assigneeId: string | null;
  readonly createdById: string;
};

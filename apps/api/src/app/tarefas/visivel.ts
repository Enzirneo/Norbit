/**
 * Da linha do banco para o que a API devolve.
 *
 * Datas saem como ISO-8601 em UTC. `dueAt` de dia inteiro é o **fim exclusivo**
 * do dia (ver `libs/domain/src/lib/agendas/dia-inteiro.ts`): para exibir a data,
 * a interface usa o dia local de `dueAt - 1ms`.
 */
import type { TarefaVisivel } from '@norbit/contracts';
import type { Task } from '@norbit/db';

export function paraTarefaVisivel(linha: Task): TarefaVisivel {
  return {
    id: linha.id,
    calendarId: linha.calendarId,
    title: linha.title,
    notes: linha.notes,
    priority: linha.priority,
    dueAt: linha.dueAt?.toISOString() ?? null,
    isDueAllDay: linha.isDueAllDay,
    completedAt: linha.completedAt?.toISOString() ?? null,
    visibility: linha.visibility,
    position: linha.position,
    parentTaskId: linha.parentTaskId,
    assigneeId: linha.assigneeId,
    createdById: linha.createdById,
  };
}

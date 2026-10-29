/**
 * Da linha do banco para o que a API devolve.
 *
 * Duas formas, de propósito. As rotas de escrita devolvem o **evento** — quem
 * cria uma série semanal recebe a série, não 52 repetições dela. A consulta de
 * intervalo devolve **ocorrências**, que é o que uma tela de calendário desenha.
 *
 * Datas saem como ISO-8601 em UTC, e o fuso do evento vai ao lado: é com ele que
 * a interface renderiza, e não com o fuso de quem está lendo. É a mesma razão de
 * `Event.timeZone` existir no banco.
 */
import type { EventoVisivel, OcorrenciaVisivel } from '@norbit/contracts';
import type { Event } from '@norbit/db';

export function paraEventoVisivel(linha: Event): EventoVisivel {
  return {
    id: linha.id,
    calendarId: linha.calendarId,
    title: linha.title,
    description: linha.description,
    location: linha.location,
    color: linha.color,
    startsAt: linha.startsAt.toISOString(),
    endsAt: linha.endsAt.toISOString(),
    isAllDay: linha.isAllDay,
    timeZone: linha.timeZone,
    status: linha.status,
    visibility: linha.visibility,
    recurrenceRule: linha.recurrenceRule,
    recurrenceParentId: linha.recurrenceParentId,
    originalStartsAt: linha.originalStartsAt?.toISOString() ?? null,
    excludedDates: linha.excludedDates.map((data) => data.toISOString()),
    createdById: linha.createdById,
  };
}

export function paraOcorrenciaVisivel(
  linha: Event,
  ocorrencia: { inicio: Date; fim: Date; inicioOriginal: Date },
): OcorrenciaVisivel {
  return {
    // O `id` é o da linha, e por isso **repete** entre as ocorrências de uma
    // série. O que identifica a instância é o par `id` + `inicioOriginal` — é
    // esse par que as rotas de "só este" recebem, e é dele que a interface
    // precisa como chave de lista.
    id: linha.id,
    calendarId: linha.calendarId,
    title: linha.title,
    description: linha.description,
    location: linha.location,
    color: linha.color,
    inicio: ocorrencia.inicio.toISOString(),
    fim: ocorrencia.fim.toISOString(),
    inicioOriginal: ocorrencia.inicioOriginal.toISOString(),
    isAllDay: linha.isAllDay,
    timeZone: linha.timeZone,
    status: linha.status,
    ehRecorrente: linha.recurrenceRule !== null,
    createdById: linha.createdById,
  };
}

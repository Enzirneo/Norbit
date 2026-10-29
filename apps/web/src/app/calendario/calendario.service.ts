/**
 * Acesso à API do calendário.
 *
 * Só HTTP e tipos de `@norbit/contracts` — nenhuma decisão de tela aqui. O
 * interceptor de `auth` já cuida do token e da renovação, então nada disto sabe
 * que existe sessão.
 */
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type {
  AgendaVisivel,
  AtualizarEvento,
  CriarEvento,
  EventoVisivel,
  OcorrenciaVisivel,
} from '@norbit/contracts';
import type { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class CalendarioService {
  private readonly http = inject(HttpClient);

  agendas(): Observable<AgendaVisivel[]> {
    return this.http.get<AgendaVisivel[]>('/api/agendas');
  }

  /**
   * As ocorrências de um intervalo.
   *
   * Sem a lista de agendas de propósito: ausente, a API devolve todas as que a
   * pessoa vê, e filtrar quais aparecem é decisão de tela — refazer a consulta
   * a cada clique na barra lateral seria uma ida ao servidor para esconder algo
   * que já está na memória.
   */
  ocorrencias(intervalo: {
    readonly de: Date;
    readonly ate: Date;
  }): Observable<OcorrenciaVisivel[]> {
    const params = new HttpParams()
      .set('de', intervalo.de.toISOString())
      .set('ate', intervalo.ate.toISOString());

    return this.http.get<OcorrenciaVisivel[]>('/api/eventos', { params });
  }

  /**
   * A linha gravada de um evento.
   *
   * O formulário de edição precisa dela, e não da ocorrência: a regra de
   * recorrência, a visibilidade e as datas excluídas não cabem numa ocorrência.
   */
  evento(id: string): Observable<EventoVisivel> {
    return this.http.get<EventoVisivel>(`/api/eventos/${id}`);
  }

  criarEvento(
    calendarId: string,
    dados: CriarEvento,
  ): Observable<EventoVisivel> {
    return this.http.post<EventoVisivel>(
      `/api/agendas/${calendarId}/eventos`,
      dados,
    );
  }

  atualizarEvento(
    id: string,
    dados: AtualizarEvento,
  ): Observable<EventoVisivel> {
    return this.http.patch<EventoVisivel>(`/api/eventos/${id}`, dados);
  }

  removerEvento(id: string): Observable<void> {
    return this.http.delete<void>(`/api/eventos/${id}`);
  }

  /**
   * As duas operações de "só este".
   *
   * O instante vai no caminho, e é o `inicioOriginal` da ocorrência — a
   * identidade dela dentro da série (ver docs/08). `encodeURIComponent` porque
   * um ISO-8601 tem `:` e `+`, que em caminho de URL não são literais.
   */
  excluirOcorrencia(id: string, inicioOriginal: string): Observable<void> {
    return this.http.delete<void>(
      `/api/eventos/${id}/ocorrencias/${encodeURIComponent(inicioOriginal)}`,
    );
  }

  destacarOcorrencia(
    id: string,
    inicioOriginal: string,
  ): Observable<EventoVisivel> {
    return this.http.post<EventoVisivel>(
      `/api/eventos/${id}/ocorrencias/${encodeURIComponent(inicioOriginal)}/destacar`,
      {},
    );
  }
}

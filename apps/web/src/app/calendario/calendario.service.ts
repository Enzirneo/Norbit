/**
 * Acesso à API do calendário.
 *
 * Só HTTP e tipos de `@norbit/contracts` — nenhuma decisão de tela aqui. O
 * interceptor de `auth` já cuida do token e da renovação, então nada disto sabe
 * que existe sessão.
 */
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { AgendaVisivel, OcorrenciaVisivel } from '@norbit/contracts';
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
}

/**
 * Acesso à API dos membros de uma agenda.
 *
 * Só HTTP. Quem pode o quê é decidido pela API; a tela apenas evita oferecer
 * o que vai falhar.
 */
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { MembroVisivel } from '@norbit/contracts';
import type { Observable } from 'rxjs';
import type { PapelConvidavel } from '../convites/papel';

@Injectable({ providedIn: 'root' })
export class MembrosService {
  private readonly http = inject(HttpClient);

  listar(calendarId: string): Observable<MembroVisivel[]> {
    return this.http.get<MembroVisivel[]>(`/api/agendas/${calendarId}/membros`);
  }

  definirPapel(
    calendarId: string,
    membroId: string,
    papel: PapelConvidavel,
  ): Observable<void> {
    return this.http.patch<void>(
      `/api/agendas/${calendarId}/membros/${membroId}`,
      { papel },
    );
  }

  remover(calendarId: string, membroId: string): Observable<void> {
    return this.http.delete<void>(
      `/api/agendas/${calendarId}/membros/${membroId}`,
    );
  }

  /** Rota própria: sair não deve exigir `gerenciar-membros`. */
  sair(calendarId: string): Observable<void> {
    return this.http.delete<void>(`/api/agendas/${calendarId}/membros/eu`);
  }
}

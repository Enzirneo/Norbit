/**
 * Acesso à API dos convites.
 *
 * Só HTTP e tipos de `@norbit/contracts`. O token do convite viaja no caminho,
 * e vem da query string da página — entrada de fora —, então é escapado: um
 * `?` ou um `/` nele não pode reescrever a rota que está sendo chamada.
 */
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type {
  ConviteCriado,
  ConviteVisivel,
  CriarConvite,
  PrevisaoDeConvite,
} from '@norbit/contracts';
import type { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ConvitesService {
  private readonly http = inject(HttpClient);

  criar(calendarId: string, dados: CriarConvite): Observable<ConviteCriado> {
    return this.http.post<ConviteCriado>(
      `/api/agendas/${calendarId}/convites`,
      dados,
    );
  }

  listar(calendarId: string): Observable<ConviteVisivel[]> {
    return this.http.get<ConviteVisivel[]>(
      `/api/agendas/${calendarId}/convites`,
    );
  }

  revogar(calendarId: string, conviteId: string): Observable<void> {
    return this.http.delete<void>(
      `/api/agendas/${calendarId}/convites/${conviteId}`,
    );
  }

  previsao(token: string): Observable<PrevisaoDeConvite> {
    return this.http.get<PrevisaoDeConvite>(this.rotaDoToken(token));
  }

  aceitar(token: string): Observable<{ calendarId: string }> {
    return this.http.post<{ calendarId: string }>(
      `${this.rotaDoToken(token)}/aceitar`,
      null,
    );
  }

  recusar(token: string): Observable<void> {
    return this.http.post<void>(`${this.rotaDoToken(token)}/recusar`, null);
  }

  private rotaDoToken(token: string): string {
    return `/api/convites/${encodeURIComponent(token)}`;
  }
}

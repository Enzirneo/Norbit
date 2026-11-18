/**
 * Os aparelhos com a conta aberta.
 *
 * Os dois pedidos levam o cookie de refresh: é por ele que o servidor sabe qual
 * item da lista é **este** aparelho (e, ao revogar, que não pode ser o atual).
 * O access token, no cabeçalho, é quem autentica.
 */
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { SessaoAtiva } from '@norbit/contracts';
import type { Observable } from 'rxjs';
import { ROTAS_DA_API } from '../auth/auth.service';

@Injectable({ providedIn: 'root' })
export class SessoesService {
  private readonly http = inject(HttpClient);

  listar(): Observable<SessaoAtiva[]> {
    return this.http.get<SessaoAtiva[]>(ROTAS_DA_API.sessoes, {
      withCredentials: true,
    });
  }

  revogar(id: string): Observable<void> {
    return this.http.delete<void>(`${ROTAS_DA_API.sessoes}/${id}`, {
      withCredentials: true,
    });
  }
}

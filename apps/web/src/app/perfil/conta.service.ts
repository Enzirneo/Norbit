/**
 * Apagar a própria conta.
 *
 * O cookie vai junto para o servidor limpá-lo na resposta; o access token, no
 * cabeçalho, é quem autentica.
 */
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { ApagarConta } from '@norbit/contracts';
import type { Observable } from 'rxjs';
import { ROTAS_DA_API } from '../auth/auth.service';

@Injectable({ providedIn: 'root' })
export class ContaService {
  private readonly http = inject(HttpClient);

  apagar(dados: ApagarConta): Observable<void> {
    return this.http.post<void>(ROTAS_DA_API.apagarConta, dados, {
      withCredentials: true,
    });
  }
}

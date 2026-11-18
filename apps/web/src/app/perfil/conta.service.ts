/**
 * Operações sobre a própria conta: apagá-la e trocar o e-mail.
 *
 * Ao apagar, o cookie vai junto para o servidor limpá-lo na resposta; o access
 * token, no cabeçalho, é quem autentica.
 */
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type {
  ApagarConta,
  ConfirmarEmail,
  TrocarEmail,
} from '@norbit/contracts';
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

  pedirTrocaDeEmail(dados: TrocarEmail): Observable<void> {
    return this.http.post<void>(ROTAS_DA_API.trocarEmail, dados);
  }

  /** Pública: o token do link é a prova, e quem clica pode estar sem sessão. */
  confirmarEmail(dados: ConfirmarEmail): Observable<void> {
    return this.http.post<void>(ROTAS_DA_API.confirmarEmail, dados);
  }
}

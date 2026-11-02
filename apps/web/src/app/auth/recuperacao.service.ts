/**
 * Recuperação de senha, do lado do navegador.
 *
 * Separada do `AuthService` porque não mexe em sessão: pedir o link e usá-lo
 * acontecem com a pessoa **fora** da conta, e nenhum dos dois entra nela.
 */
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { EsqueciSenha, RedefinirSenha } from '@norbit/contracts';
import type { Observable } from 'rxjs';
import { ROTAS_DA_API } from './auth.service';

@Injectable({ providedIn: 'root' })
export class RecuperacaoService {
  private readonly http = inject(HttpClient);

  pedirLink(dados: EsqueciSenha): Observable<void> {
    return this.http.post<void>(ROTAS_DA_API.esqueciSenha, dados);
  }

  redefinir(dados: RedefinirSenha): Observable<void> {
    return this.http.post<void>(ROTAS_DA_API.redefinirSenha, dados);
  }
}

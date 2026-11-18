/**
 * Trocar a senha estando logado.
 *
 * Fora do `AuthService` porque não cria nem encerra sessão: a daqui continua, e
 * o servidor é quem derruba as dos outros aparelhos.
 */
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { TrocarSenha } from '@norbit/contracts';
import type { Observable } from 'rxjs';
import { ROTAS_DA_API } from '../auth/auth.service';

@Injectable({ providedIn: 'root' })
export class SenhaService {
  private readonly http = inject(HttpClient);

  trocar(dados: TrocarSenha): Observable<void> {
    // O cookie vai junto para o servidor saber **qual** aparelho poupar; o
    // access token, no cabeçalho, é quem autentica.
    return this.http.post<void>(ROTAS_DA_API.trocarSenha, dados, {
      withCredentials: true,
    });
  }
}

import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { AtualizarPerfil, UsuarioAutenticado } from '@norbit/contracts';
import { tap, type Observable } from 'rxjs';
import { AuthService } from '../auth/auth.service';

@Injectable({ providedIn: 'root' })
export class PerfilService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  /**
   * Grava e já atualiza o usuário que a tela inteira lê: sem isso o nome no
   * canto continuaria o antigo até a próxima renovação da sessão.
   */
  atualizar(dados: AtualizarPerfil): Observable<UsuarioAutenticado> {
    return this.http
      .patch<UsuarioAutenticado>('/api/perfil', dados)
      .pipe(tap((usuario) => this.auth.atualizarUsuario(usuario)));
  }
}

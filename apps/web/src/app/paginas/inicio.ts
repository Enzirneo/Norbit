/**
 * Página inicial provisória.
 *
 * Existe para provar que a sessão funciona de ponta a ponta — e para dar um
 * lugar de onde sair. A agenda de verdade é a Fase 2.
 */
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { Botao } from '../ui/botao';
import { FundoOrbital } from '../ui/fundo-orbital';
import { Marca } from '../ui/marca';

@Component({
  selector: 'nb-inicio',
  imports: [Botao, FundoOrbital, Marca],
  templateUrl: './inicio.html',
  styleUrl: './inicio.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Inicio {
  private readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  protected readonly usuario = this.auth.usuario;
  protected readonly perfilRecarregado = signal<string | null>(null);

  /**
   * Chama uma rota protegida de propósito.
   *
   * É o botão que exercita o interceptor: se o access token já expirou, a
   * renovação acontece sem que esta tela saiba, e o nome volta igual.
   */
  protected recarregarPerfil(): void {
    this.http
      .get<{ displayName: string }>('/api/auth/eu')
      .subscribe((perfil) => {
        this.perfilRecarregado.set(
          `${perfil.displayName} — lido às ${new Date().toLocaleTimeString('pt-BR')}`,
        );
      });
  }

  protected sair(): void {
    this.auth.sair().subscribe(() => {
      void this.router.navigateByUrl('/entrar');
    });
  }
}

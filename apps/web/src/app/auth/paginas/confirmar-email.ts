/**
 * A tela do link de confirmação do e-mail novo.
 *
 * Um botão em vez de confirmar ao abrir: abrir um link não deve mudar a conta
 * (pré-visualizadores de e-mail e de mensagens abrem links por conta própria).
 * Ao concluir, o servidor encerrou todas as sessões; esta tela esquece a daqui
 * e manda a pessoa entrar com o endereço novo.
 */
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ContaService } from '../../perfil/conta.service';
import { Botao } from '../../ui/botao';
import { AuthService } from '../auth.service';
import { errosDaApi } from '../erros-de-formulario';
import { Moldura } from './moldura';
import { Aviso } from '../../ui/aviso';

@Component({
  selector: 'nb-confirmar-email',
  imports: [Aviso, RouterLink, Moldura, Botao],
  templateUrl: './confirmar-email.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmarEmail {
  private readonly conta = inject(ContaService);
  private readonly auth = inject(AuthService);

  /** O token vem do link do e-mail; sem ele não há o que confirmar. */
  protected readonly token =
    inject(ActivatedRoute).snapshot.queryParamMap.get('token') ?? '';

  protected readonly enviando = signal(false);
  protected readonly concluido = signal(false);
  protected readonly erro = signal<string | null>(null);

  protected confirmar(): void {
    this.erro.set(null);
    this.enviando.set(true);

    this.conta.confirmarEmail({ token: this.token }).subscribe({
      next: () => {
        this.auth.limpar();
        this.enviando.set(false);
        this.concluido.set(true);
      },
      error: (falha: unknown) => {
        this.enviando.set(false);
        this.erro.set(errosDaApi(falha)['formulario'] ?? 'Não foi possível.');
      },
    });
  }
}

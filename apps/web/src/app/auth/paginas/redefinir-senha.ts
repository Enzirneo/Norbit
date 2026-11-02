import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { redefinirSenhaSchema } from '@norbit/contracts';
import { Botao } from '../../ui/botao';
import { Campo } from '../../ui/campo';
import { AuthService } from '../auth.service';
import {
  errosDaApi,
  errosDoZod,
  type ErrosPorCampo,
} from '../erros-de-formulario';
import { RecuperacaoService } from '../recuperacao.service';
import { Moldura } from './moldura';

@Component({
  selector: 'nb-redefinir-senha',
  imports: [ReactiveFormsModule, RouterLink, Moldura, Campo, Botao],
  templateUrl: './redefinir-senha.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RedefinirSenha {
  private readonly recuperacao = inject(RecuperacaoService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  /** O token vem do link do e-mail; sem ele não há o que redefinir. */
  protected readonly token =
    inject(ActivatedRoute).snapshot.queryParamMap.get('token') ?? '';

  protected readonly formulario = this.fb.nonNullable.group({ password: '' });

  protected readonly erros = signal<ErrosPorCampo>({});
  protected readonly enviando = signal(false);
  protected readonly concluido = signal(false);

  protected enviar(): void {
    const validado = redefinirSenhaSchema.safeParse({
      token: this.token,
      password: this.formulario.getRawValue().password,
    });

    if (!validado.success) {
      this.erros.set(errosDoZod(validado.error));
      return;
    }

    this.erros.set({});
    this.enviando.set(true);

    this.recuperacao.redefinir(validado.data).subscribe({
      next: () => {
        // O servidor encerrou todas as sessões da conta. Esquecer a daqui
        // também evita que a tela continue "logada" com um token que, a partir
        // de agora, não renova mais.
        this.auth.limpar();
        this.enviando.set(false);
        this.concluido.set(true);
      },
      error: (erro: unknown) => {
        this.enviando.set(false);
        this.erros.set(errosDaApi(erro));
      },
    });
  }
}

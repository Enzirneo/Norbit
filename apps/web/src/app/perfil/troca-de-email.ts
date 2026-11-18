/**
 * Trocar o e-mail, dentro da tela de perfil.
 *
 * Pede a senha: o e-mail é o destino da recuperação, e quem pegasse um aparelho
 * desbloqueado não deve conseguir redirecioná-la. A troca só vale depois do
 * link enviado ao endereço novo, então a tela não anuncia sucesso da troca:
 * anuncia o envio. E fala "se puder ser usado" porque o servidor responde igual
 * para endereços que já têm dono.
 */
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { trocarEmailSchema } from '@norbit/contracts';
import { AuthService } from '../auth/auth.service';
import {
  errosDaApi,
  errosDoZod,
  type ErrosPorCampo,
} from '../auth/erros-de-formulario';
import { Botao } from '../ui/botao';
import { Campo } from '../ui/campo';
import { ContaService } from './conta.service';

@Component({
  selector: 'nb-troca-de-email',
  imports: [ReactiveFormsModule, Botao, Campo],
  templateUrl: './troca-de-email.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrocaDeEmail {
  private readonly conta = inject(ContaService);
  private readonly fb = inject(FormBuilder);

  protected readonly usuario = inject(AuthService).usuario;

  protected readonly formulario = this.fb.nonNullable.group({
    novoEmail: '',
    senha: '',
  });

  protected readonly erros = signal<ErrosPorCampo>({});
  protected readonly enviando = signal(false);
  protected readonly enviado = signal<string | null>(null);

  protected enviar(): void {
    this.enviado.set(null);
    const validado = trocarEmailSchema.safeParse(this.formulario.getRawValue());

    if (!validado.success) {
      this.erros.set(errosDoZod(validado.error));
      return;
    }

    this.erros.set({});
    this.enviando.set(true);

    this.conta.pedirTrocaDeEmail(validado.data).subscribe({
      next: () => {
        this.enviando.set(false);
        this.enviado.set(validado.data.novoEmail);
        // Não deixa a senha no formulário depois de usada.
        this.formulario.reset();
      },
      error: (erro: unknown) => {
        this.enviando.set(false);
        this.erros.set(errosDaApi(erro));
      },
    });
  }
}

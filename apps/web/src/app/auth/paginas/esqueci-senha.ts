import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { esqueciSenhaSchema } from '@norbit/contracts';
import { Botao } from '../../ui/botao';
import { Campo } from '../../ui/campo';
import {
  errosDaApi,
  errosDoZod,
  type ErrosPorCampo,
} from '../erros-de-formulario';
import { RecuperacaoService } from '../recuperacao.service';
import { Moldura } from './moldura';

@Component({
  selector: 'nb-esqueci-senha',
  imports: [ReactiveFormsModule, RouterLink, Moldura, Campo, Botao],
  templateUrl: './esqueci-senha.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EsqueciSenha {
  private readonly recuperacao = inject(RecuperacaoService);
  private readonly fb = inject(FormBuilder);

  protected readonly formulario = this.fb.nonNullable.group({ email: '' });

  protected readonly erros = signal<ErrosPorCampo>({});
  protected readonly enviando = signal(false);
  protected readonly enviado = signal(false);

  protected enviar(): void {
    const validado = esqueciSenhaSchema.safeParse(
      this.formulario.getRawValue(),
    );

    if (!validado.success) {
      this.erros.set(errosDoZod(validado.error));
      return;
    }

    this.erros.set({});
    this.enviando.set(true);

    this.recuperacao.pedirLink(validado.data).subscribe({
      next: () => {
        this.enviando.set(false);
        this.enviado.set(true);
      },
      error: (erro: unknown) => {
        this.enviando.set(false);
        this.erros.set(errosDaApi(erro));
      },
    });
  }
}

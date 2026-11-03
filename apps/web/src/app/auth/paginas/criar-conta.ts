import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { cadastroSchema } from '@norbit/contracts';
import { Botao } from '../../ui/botao';
import { Campo } from '../../ui/campo';
import { Moldura } from './moldura';
import { AuthService } from '../auth.service';
import { destinoSeguro } from '../destino';
import {
  errosDaApi,
  errosDoZod,
  type ErrosPorCampo,
} from '../erros-de-formulario';

@Component({
  selector: 'nb-criar-conta',
  imports: [ReactiveFormsModule, RouterLink, Moldura, Campo, Botao],
  templateUrl: './criar-conta.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CriarConta {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  /** De onde a pessoa veio, para voltar e para repassar ao login. */
  protected readonly voltarPara =
    inject(ActivatedRoute).snapshot.queryParamMap.get('voltarPara');

  protected readonly formulario = this.fb.nonNullable.group({
    displayName: '',
    handle: '',
    email: '',
    password: '',
  });

  protected readonly erros = signal<ErrosPorCampo>({});
  protected readonly enviando = signal(false);

  protected enviar(): void {
    const validado = cadastroSchema.safeParse(this.formulario.getRawValue());

    if (!validado.success) {
      this.erros.set(errosDoZod(validado.error));
      return;
    }

    this.erros.set({});
    this.enviando.set(true);

    this.auth.cadastrar(validado.data).subscribe({
      next: () => {
        // Já entra: pedir para fazer login depois de criar a conta é um passo
        // sem propósito, e o servidor já devolveu a sessão. Volta para onde a
        // pessoa estava — quem veio de um convite precisa terminar nele.
        void this.router.navigateByUrl(destinoSeguro(this.voltarPara));
      },
      error: (erro: unknown) => {
        this.enviando.set(false);
        this.erros.set(errosDaApi(erro));
      },
    });
  }
}

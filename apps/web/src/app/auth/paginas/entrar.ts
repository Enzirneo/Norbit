import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { loginSchema } from '@norbit/contracts';
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
  selector: 'nb-entrar',
  imports: [ReactiveFormsModule, RouterLink, Moldura, Campo, Botao],
  templateUrl: './entrar.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Entrar {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  /** De onde a pessoa veio, para voltar e para repassar ao cadastro. */
  protected readonly voltarPara =
    inject(ActivatedRoute).snapshot.queryParamMap.get('voltarPara');

  protected readonly formulario = this.fb.nonNullable.group({
    email: '',
    password: '',
  });

  protected readonly erros = signal<ErrosPorCampo>({});
  protected readonly enviando = signal(false);

  protected enviar(): void {
    // O mesmo schema que a API aplica, rodando antes de sair do navegador.
    // Não é a validação que conta — a que conta é a do servidor —, mas evita
    // uma ida e volta para dizer o que já se sabia.
    const validado = loginSchema.safeParse(this.formulario.getRawValue());

    if (!validado.success) {
      this.erros.set(errosDoZod(validado.error));
      return;
    }

    this.erros.set({});
    this.enviando.set(true);

    this.auth.entrar(validado.data).subscribe({
      next: () => {
        void this.router.navigateByUrl(this.destino());
      },
      error: (erro: unknown) => {
        this.enviando.set(false);
        this.erros.set(errosDaApi(erro));
      },
    });
  }

  /** Para onde ir depois de entrar: o que o guard guardou, ou a raiz. */
  private destino(): string {
    return destinoSeguro(this.voltarPara);
  }
}

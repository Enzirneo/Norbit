/**
 * Apagar a própria conta, dentro da tela de perfil.
 *
 * Em dois passos: o botão só abre a confirmação, que pede a senha. Quem pegasse
 * um aparelho desbloqueado não deve conseguir apagar a conta com um clique. Se
 * a pessoa ainda é dona de agenda compartilhada, o servidor recusa e diz quais;
 * a mensagem aparece aqui.
 */
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { apagarContaSchema } from '@norbit/contracts';
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
  selector: 'nb-apagar-conta',
  imports: [ReactiveFormsModule, Botao, Campo],
  templateUrl: './apagar-conta.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApagarConta {
  private readonly conta = inject(ContaService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  protected readonly formulario = this.fb.nonNullable.group({ senha: '' });

  protected readonly confirmando = signal(false);
  protected readonly erros = signal<ErrosPorCampo>({});
  protected readonly enviando = signal(false);

  protected abrir(): void {
    this.confirmando.set(true);
  }

  protected cancelar(): void {
    this.confirmando.set(false);
    this.erros.set({});
    this.formulario.reset();
  }

  protected apagar(): void {
    const validado = apagarContaSchema.safeParse(this.formulario.getRawValue());

    if (!validado.success) {
      this.erros.set(errosDoZod(validado.error));
      return;
    }

    this.erros.set({});
    this.enviando.set(true);

    this.conta.apagar(validado.data).subscribe({
      next: () => {
        // A sessão acabou no servidor: o cliente também deixa de se comportar
        // como logado, sem chamar o logout de uma conta que já não existe.
        this.auth.limpar();
        void this.router.navigateByUrl('/entrar');
      },
      error: (erro: unknown) => {
        this.enviando.set(false);
        this.erros.set(errosDaApi(erro));
      },
    });
  }
}

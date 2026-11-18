/**
 * O formulário de trocar a senha, dentro da tela de perfil.
 *
 * Pede a senha atual: quem pegasse um aparelho desbloqueado não deve conseguir
 * trocar a senha e trancar a dona da conta do lado de fora.
 */
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { trocarSenhaSchema } from '@norbit/contracts';
import {
  errosDaApi,
  errosDoZod,
  type ErrosPorCampo,
} from '../auth/erros-de-formulario';
import { Botao } from '../ui/botao';
import { Campo } from '../ui/campo';
import { SenhaService } from './senha.service';

@Component({
  selector: 'nb-troca-de-senha',
  imports: [ReactiveFormsModule, Botao, Campo],
  templateUrl: './troca-de-senha.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrocaDeSenha {
  private readonly senha = inject(SenhaService);
  private readonly fb = inject(FormBuilder);

  protected readonly formulario = this.fb.nonNullable.group({
    senhaAtual: '',
    novaSenha: '',
  });

  protected readonly erros = signal<ErrosPorCampo>({});
  protected readonly enviando = signal(false);
  protected readonly trocada = signal(false);

  protected enviar(): void {
    this.trocada.set(false);
    const validado = trocarSenhaSchema.safeParse(this.formulario.getRawValue());

    if (!validado.success) {
      this.erros.set(errosDoZod(validado.error));
      return;
    }

    this.erros.set({});
    this.enviando.set(true);

    this.senha.trocar(validado.data).subscribe({
      next: () => {
        this.enviando.set(false);
        this.trocada.set(true);
        // Não deixa as duas senhas no formulário depois de usadas.
        this.formulario.reset();
      },
      error: (erro: unknown) => {
        this.enviando.set(false);
        this.erros.set(errosDaApi(erro));
      },
    });
  }
}

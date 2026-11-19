/**
 * A tela de perfil: nome, handle, fuso e senha.
 *
 * Ao contrário das preferências, aqui há um botão "Salvar": trocar o handle
 * muda o endereço público da pessoa, e uma alteração com esse peso não deve
 * acontecer a cada tecla.
 */
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { atualizarPerfilSchema } from '@norbit/contracts';
import { AuthService } from '../../auth/auth.service';
import {
  errosDaApi,
  errosDoZod,
  type ErrosPorCampo,
} from '../../auth/erros-de-formulario';
import { Botao } from '../../ui/botao';
import { MolduraDeConfiguracoes } from '../../configuracoes/moldura-de-configuracoes';
import { Campo } from '../../ui/campo';
import { ToastService } from '../../ui/toast.service';
import { ApagarConta } from '../apagar-conta';
import { PerfilService } from '../perfil.service';
import { SessoesAtivas } from '../sessoes-ativas';
import { TrocaDeEmail } from '../troca-de-email';
import { TrocaDeSenha } from '../troca-de-senha';
import { Aviso } from '../../ui/aviso';
import { Avatar } from '../../ui/avatar';
import { CartaoDeSecao } from '../../ui/cartao-de-secao';

@Component({
  selector: 'nb-perfil',
  imports: [
    CartaoDeSecao,
    Avatar,
    Aviso,
    ReactiveFormsModule,
    ApagarConta,
    Botao,
    Campo,
    MolduraDeConfiguracoes,
    SessoesAtivas,
    TrocaDeEmail,
    TrocaDeSenha,
  ],
  templateUrl: './perfil.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Perfil {
  private readonly perfil = inject(PerfilService);
  private readonly fb = inject(FormBuilder);
  protected readonly usuario = inject(AuthService).usuario;

  protected readonly fusos = Intl.supportedValuesOf('timeZone');

  protected readonly formulario = this.fb.nonNullable.group({
    displayName: this.usuario()?.displayName ?? '',
    handle: this.usuario()?.handle ?? '',
    timeZone: this.usuario()?.timeZone ?? '',
  });

  private readonly toasts = inject(ToastService);

  protected readonly erros = signal<ErrosPorCampo>({});
  protected readonly salvando = signal(false);

  protected salvar(): void {
    const validado = atualizarPerfilSchema.safeParse(
      this.formulario.getRawValue(),
    );

    if (!validado.success) {
      this.erros.set(errosDoZod(validado.error));
      return;
    }

    this.erros.set({});
    this.salvando.set(true);

    this.perfil.atualizar(validado.data).subscribe({
      next: (usuario) => {
        this.salvando.set(false);
        this.toasts.mostrar('Perfil salvo.');
        // O servidor devolve a forma canônica (handle em minúsculas, fuso com a
        // grafia certa); o formulário passa a mostrá-la.
        this.formulario.reset({
          displayName: usuario.displayName,
          handle: usuario.handle,
          timeZone: usuario.timeZone,
        });
      },
      error: (erro: unknown) => {
        this.salvando.set(false);
        this.erros.set(errosDaApi(erro));
      },
    });
  }
}

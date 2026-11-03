/**
 * A tela de perfil: nome, handle e fuso.
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
import { Router } from '@angular/router';
import { atualizarPerfilSchema } from '@norbit/contracts';
import { AuthService } from '../../auth/auth.service';
import {
  errosDaApi,
  errosDoZod,
  type ErrosPorCampo,
} from '../../auth/erros-de-formulario';
import { Botao } from '../../ui/botao';
import { Campo } from '../../ui/campo';
import { Marca } from '../../ui/marca';
import { iniciaisDe } from '../iniciais';
import { PerfilService } from '../perfil.service';

@Component({
  selector: 'nb-perfil',
  imports: [ReactiveFormsModule, Botao, Campo, Marca],
  templateUrl: './perfil.html',
  // As mesmas classes de layout das preferências: são duas telas de ajustes da
  // conta, e duas folhas iguais divergiriam na primeira alteração.
  styleUrl: '../../preferencias/paginas/preferencias.scss',
  styles: `
    .avatar {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      inline-size: 4rem;
      block-size: 4rem;
      margin-block-end: 1rem;
      border-radius: 9999px;
      background: var(--accent-muted);
      color: var(--text-primary);
      font-size: 1.25rem;
      font-weight: 600;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Perfil {
  private readonly router = inject(Router);
  private readonly perfil = inject(PerfilService);
  private readonly fb = inject(FormBuilder);
  protected readonly usuario = inject(AuthService).usuario;

  protected readonly fusos = Intl.supportedValuesOf('timeZone');

  protected readonly formulario = this.fb.nonNullable.group({
    displayName: this.usuario()?.displayName ?? '',
    handle: this.usuario()?.handle ?? '',
    timeZone: this.usuario()?.timeZone ?? '',
  });

  protected readonly erros = signal<ErrosPorCampo>({});
  protected readonly salvando = signal(false);
  protected readonly salvo = signal(false);

  protected iniciais(): string {
    return iniciaisDe(this.usuario()?.displayName ?? '');
  }

  protected voltar(): void {
    void this.router.navigateByUrl('/');
  }

  protected salvar(): void {
    this.salvo.set(false);
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
        this.salvo.set(true);
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

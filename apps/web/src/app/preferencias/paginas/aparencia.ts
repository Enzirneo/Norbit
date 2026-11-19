/**
 * A tela de aparência: o editor de tema, a densidade e o movimento.
 *
 * O tema se edita num rascunho e só vale ao salvar (`nb-editor-de-tema`); a
 * densidade e o movimento salvam a cada alteração, como as preferências do
 * calendário.
 */
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import type { AtualizarPreferencias } from '@norbit/contracts';
import { EditorDeTema } from '../../configuracoes/editor-de-tema';
import { MolduraDeConfiguracoes } from '../../configuracoes/moldura-de-configuracoes';
import { Aviso } from '../../ui/aviso';
import { Campo } from '../../ui/campo';
import { CartaoDeSecao } from '../../ui/cartao-de-secao';
import { ToastService } from '../../ui/toast.service';
import { PreferenciasService } from '../preferencias.service';

@Component({
  selector: 'nb-aparencia',
  imports: [Aviso, Campo, CartaoDeSecao, EditorDeTema, MolduraDeConfiguracoes],
  templateUrl: './aparencia.html',
  styleUrl: './aparencia.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Aparencia {
  private readonly api = inject(PreferenciasService);
  private readonly toasts = inject(ToastService);

  protected readonly atuais = this.api.preferencias;
  protected readonly erro = signal<string | null>(null);
  /** O editor só nasce depois da carga: o rascunho parte do tema da conta. */
  protected readonly carregado = signal(false);

  protected readonly densidades = [
    { valor: 0, rotulo: 'Compacta' },
    { valor: 1, rotulo: 'Confortável' },
    { valor: 2, rotulo: 'Espaçosa' },
  ];

  constructor() {
    this.api.carregar().subscribe({
      next: () => this.carregado.set(true),
      error: () =>
        this.erro.set('Não foi possível carregar suas preferências.'),
    });
  }

  protected alterar(dados: AtualizarPreferencias): void {
    this.erro.set(null);

    this.api.atualizar(dados).subscribe({
      next: () => this.toasts.mostrar('Preferências salvas.'),
      error: () =>
        this.erro.set('Não foi possível salvar. A preferência não mudou.'),
    });
  }

  protected alterarDensidade(valor: string): void {
    this.alterar({ density: Number(valor) });
  }
}

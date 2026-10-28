/**
 * Botão.
 *
 * Consome apenas a camada semântica: nenhuma cor literal, nenhum primitivo.
 * Trocar de preset redefine `--accent` e este componente não é tocado — que é
 * a razão de a camada existir.
 */
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

export type AparenciaDeBotao = 'solido' | 'contorno' | 'texto';

@Component({
  selector: 'button[nb-botao]',
  template: `
    @if (ocupado()) {
      <span class="orbita" aria-hidden="true"></span>
    }
    <ng-content />
  `,
  styleUrl: './botao.scss',
  host: {
    '[class]': 'classes()',
    '[disabled]': 'desabilitado() || ocupado()',
    // Quem usa leitor de tela precisa saber que a ação está em curso; sem
    // isto, o botão só fica inerte sem explicação.
    '[attr.aria-busy]': 'ocupado() || null',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Botao {
  readonly aparencia = input<AparenciaDeBotao>('solido');
  readonly desabilitado = input(false);
  readonly ocupado = input(false);

  protected readonly classes = computed(
    () => `botao botao--${this.aparencia()}`,
  );
}

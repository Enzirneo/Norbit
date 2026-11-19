/**
 * O cartão da lua, na barra lateral: a fase de hoje, com o nome e quanto da lua
 * está iluminada.
 *
 * A conta (fase, nome, iluminação) vem de `libs/domain`; o desenho, do `Lua`. Aqui
 * só se junta o dia a quem desenha e a quem escreve.
 */
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import {
  faseDoDia,
  iluminacao,
  nomeDaFase,
  type DataCivil,
} from '@norbit/domain';
import { Lua } from '../ui/lua';

@Component({
  selector: 'nb-cartao-da-lua',
  imports: [Lua],
  template: `
    <div class="cartao-da-lua">
      <nb-lua [fase]="fase()" [tamanho]="34" />
      <div class="texto">
        <b class="nome">{{ nome() }}</b>
        <small class="iluminacao">{{ iluminada() }}% iluminada hoje</small>
      </div>
    </div>
  `,
  styleUrl: './cartao-da-lua.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CartaoDaLua {
  /** O dia que o cartão mostra, normalmente hoje. */
  readonly dia = input.required<DataCivil>();

  protected readonly fase = computed(() => faseDoDia(this.dia()));
  protected readonly nome = computed(() => nomeDaFase(this.fase()));
  protected readonly iluminada = computed(() => iluminacao(this.fase()));
}

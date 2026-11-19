/**
 * O aviso: uma mensagem no meio da página, com o tom dado pelo tipo.
 *
 * O papel para o leitor de tela acompanha o tipo: um perigo interrompe
 * (`alert`), e uma informação ou um sucesso esperam a vez (`status`). Era um
 * `role="alert"` espalhado à mão em cada tela, e um esquecido deixava o erro mudo.
 */
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

export type TipoDeAviso = 'info' | 'sucesso' | 'perigo';

@Component({
  selector: 'nb-aviso',
  template: `<ng-content />`,
  styleUrl: './aviso.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.role]': 'papel()',
    '[class]': '"aviso--" + tipo()',
  },
})
export class Aviso {
  readonly tipo = input<TipoDeAviso>('info');

  protected readonly papel = computed(() =>
    this.tipo() === 'perigo' ? 'alert' : 'status',
  );
}

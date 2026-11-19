/** A etiqueta: um rótulo curto e discreto ("Dono", "Padrão"). */
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type TomDaEtiqueta = 'neutro' | 'destaque';

@Component({
  selector: 'nb-etiqueta',
  template: `<ng-content />`,
  styleUrl: './etiqueta.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': '"etiqueta--" + tom()' },
})
export class Etiqueta {
  readonly tom = input<TomDaEtiqueta>('neutro');
}

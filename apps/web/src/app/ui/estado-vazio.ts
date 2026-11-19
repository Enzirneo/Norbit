/** O estado vazio: o que a tela diz quando não há nada para mostrar. */
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'nb-estado-vazio',
  template: `
    <div class="vazio">
      <strong class="vazio-titulo">{{ titulo() }}</strong>
      <span><ng-content /></span>
    </div>
  `,
  styleUrl: './estado-vazio.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EstadoVazio {
  readonly titulo = input.required<string>();
}

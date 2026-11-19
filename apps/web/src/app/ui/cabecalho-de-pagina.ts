/** O cabeçalho de página: o título (h1) das telas de ajuste. */
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'nb-cabecalho-de-pagina',
  template: `<h1 class="titulo">{{ titulo() }}</h1>`,
  styleUrl: './cabecalho-de-pagina.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CabecalhoDePagina {
  readonly titulo = input.required<string>();
}

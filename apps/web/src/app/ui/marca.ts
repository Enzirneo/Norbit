/**
 * A marca: um sinal orbital e o nome.
 *
 * O sinal é um ponto numa órbita achatada — a ideia do produto reduzida ao
 * menor desenho possível. Sem fonte futurista e sem borda neon: o docs/04
 * descarta as duas.
 */
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'nb-marca',
  templateUrl: './marca.html',
  styleUrl: './marca.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Marca {
  /** Esconde o nome, deixando só o sinal — para barras estreitas. */
  readonly somenteSinal = input(false);
}

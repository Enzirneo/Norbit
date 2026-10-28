/**
 * A moldura das telas de entrada: fundo orbital, marca e um cartão centralizado.
 *
 * Compartilhada entre entrar e criar-conta para que as duas não divirjam — é
 * o mesmo momento do produto visto duas vezes.
 */
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FundoOrbital } from '../../ui/fundo-orbital';
import { Marca } from '../../ui/marca';

@Component({
  selector: 'nb-moldura',
  imports: [FundoOrbital, Marca],
  templateUrl: './moldura.html',
  styleUrl: './moldura.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Moldura {
  readonly titulo = input.required<string>();
  readonly subtitulo = input<string | undefined>(undefined);
}

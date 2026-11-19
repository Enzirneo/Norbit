/**
 * O cartão de seção: um bloco de uma tela de ajustes, com título pequeno.
 *
 * É uma `section` nomeada pelo próprio título (`aria-labelledby`), para o
 * leitor de tela listá-la como região.
 */
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

let proximo = 0;

@Component({
  selector: 'nb-cartao-de-secao',
  template: `
    <section class="secao" [attr.aria-labelledby]="idDoTitulo">
      <h2 class="secao-titulo" [id]="idDoTitulo">{{ titulo() }}</h2>
      <ng-content />
    </section>
  `,
  styleUrl: './cartao-de-secao.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CartaoDeSecao {
  readonly titulo = input.required<string>();
  protected readonly idDoTitulo = `secao-titulo-${proximo++}`;
}

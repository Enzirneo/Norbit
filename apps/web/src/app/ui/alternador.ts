/**
 * O alternador: uma escolha exclusiva entre poucas opções, lado a lado.
 *
 * É um grupo de rádio (`radiogroup`), e não três botões soltos: a escolha é
 * exclusiva, e é isso que o leitor de tela precisa ouvir. Com botões, nenhum
 * deles anunciaria estar selecionado.
 *
 * Segue o padrão de teclado de um grupo de rádio: só a opção escolhida entra na
 * ordem do Tab, e as setas (também as de cima e de baixo) escolhem a vizinha, com
 * volta nas pontas; Home e End vão às pontas. O foco acompanha a escolha.
 */
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  output,
} from '@angular/core';

export type OpcaoDoAlternador<T extends string> = {
  readonly valor: T;
  readonly rotulo: string;
};

@Component({
  selector: 'nb-alternador',
  template: `
    <div class="alternador" role="radiogroup" [attr.aria-label]="rotulo()">
      @for (opcao of opcoes(); track opcao.valor; let i = $index) {
        <button
          class="opcao"
          type="button"
          role="radio"
          [class.opcao--ativa]="opcao.valor === valor()"
          [attr.aria-checked]="opcao.valor === valor()"
          [attr.tabindex]="opcao.valor === valor() ? 0 : -1"
          (click)="escolhido.emit(opcao.valor)"
          (keydown)="aoTeclar($event, i)"
        >
          {{ opcao.rotulo }}
        </button>
      }
    </div>
  `,
  styleUrl: './alternador.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Alternador<T extends string> {
  private readonly elemento = inject<ElementRef<HTMLElement>>(ElementRef);

  /** O nome do grupo, para o leitor de tela ("Visão do calendário"). */
  readonly rotulo = input.required<string>();
  readonly opcoes = input.required<readonly OpcaoDoAlternador<T>[]>();
  readonly valor = input.required<T>();

  readonly escolhido = output<T>();

  protected aoTeclar(evento: KeyboardEvent, atual: number): void {
    const destino = this.destinoDaTecla(evento.key, atual);
    if (destino === null) {
      return;
    }

    evento.preventDefault();
    const opcao = this.opcoes()[destino];
    if (opcao) {
      this.escolhido.emit(opcao.valor);
      this.focar(destino);
    }
  }

  /** O índice da opção a que a tecla leva a partir da que tem o foco, ou `null` se a tecla não é nossa. */
  private destinoDaTecla(tecla: string, atual: number): number | null {
    const total = this.opcoes().length;

    switch (tecla) {
      case 'ArrowRight':
      case 'ArrowDown':
        return (atual + 1) % total;
      case 'ArrowLeft':
      case 'ArrowUp':
        return (atual - 1 + total) % total;
      case 'Home':
        return 0;
      case 'End':
        return total - 1;
      default:
        return null;
    }
  }

  /**
   * Leva o foco à opção escolhida.
   *
   * Na hora: um botão com `tabindex="-1"` aceita foco por código, então não é
   * preciso esperar o valor novo chegar e a opção virar a do Tab.
   */
  private focar(indice: number): void {
    this.elemento.nativeElement
      .querySelectorAll<HTMLButtonElement>('button')
      [indice]?.focus();
  }
}

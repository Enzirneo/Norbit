/**
 * Diálogo modal.
 *
 * Usa o `<dialog>` nativo com `showModal()`, e não uma `div` com `role="dialog"`.
 * O elemento nativo traz de graça o que uma reimplementação sempre erra em
 * algum detalhe: foco preso dentro do diálogo, `Esc` fechando, o resto da
 * página inerte para leitor de tela e para o `Tab`, e o fundo por `::backdrop`.
 *
 * O que ainda é nosso: devolver o foco a quem abriu, e fechar ao clicar fora.
 */
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  input,
  output,
  viewChild,
} from '@angular/core';

@Component({
  selector: 'nb-dialogo',
  template: `
    <dialog #elemento class="dialogo" (close)="fechado.emit()">
      <h2 class="titulo">{{ titulo() }}</h2>
      <ng-content />
    </dialog>
  `,
  styleUrl: './dialogo.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dialogo {
  readonly titulo = input.required<string>();
  readonly aberto = input.required<boolean>();
  readonly fechado = output<void>();

  private readonly elemento =
    viewChild.required<ElementRef<HTMLDialogElement>>('elemento');

  /** Quem tinha o foco antes de abrir, para devolvê-lo ao fechar. */
  private anterior: Element | null = null;

  constructor() {
    effect(() => {
      const dialogo = this.elemento().nativeElement;

      if (this.aberto()) {
        if (!dialogo.open) {
          this.anterior = document.activeElement;
          dialogo.showModal();
        }
        return;
      }

      if (dialogo.open) {
        dialogo.close();
      }

      // Sem isto o foco volta para o começo da página, e quem navega por
      // teclado precisa percorrer a tela toda para chegar de novo onde estava.
      if (this.anterior instanceof HTMLElement) {
        this.anterior.focus();
        this.anterior = null;
      }
    });
  }
}

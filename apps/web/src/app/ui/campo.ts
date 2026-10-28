/**
 * Rótulo, controle, dica e erro — a estrutura de um campo de formulário.
 *
 * O `<label>` envolve o controle projetado, então a associação é implícita:
 * não há `id` para sincronizar, e não há como alguém esquecer o `for` e
 * quebrar o leitor de tela sem ninguém perceber.
 */
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'nb-campo',
  templateUrl: './campo.html',
  styleUrl: './campo.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Campo {
  readonly rotulo = input.required<string>();
  readonly dica = input<string | undefined>(undefined);
  readonly erro = input<string | undefined>(undefined);
}

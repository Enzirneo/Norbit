/** O lugar onde os toasts aparecem. Um só, na raiz do app. */
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from './toast.service';

@Component({
  selector: 'nb-toasts',
  template: `
    <div class="pilha" role="region" aria-label="Notificações">
      @for (toast of servico.toasts(); track toast.id) {
        <div
          class="toast"
          [class]="'toast toast--' + toast.tipo"
          [attr.role]="toast.tipo === 'perigo' ? 'alert' : 'status'"
        >
          <span class="texto">{{ toast.texto }}</span>
          <button
            class="fechar"
            type="button"
            aria-label="Fechar aviso"
            (click)="servico.dispensar(toast.id)"
          >
            ×
          </button>
        </div>
      }
    </div>
  `,
  styleUrl: './toasts.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Toasts {
  protected readonly servico = inject(ToastService);
}

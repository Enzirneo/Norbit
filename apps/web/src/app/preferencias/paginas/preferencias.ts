/**
 * A tela de preferências do calendário.
 *
 * Salva **a cada alteração**, e não num botão "salvar". Preferência é ajuste
 * fino: a pessoa muda, olha o resultado e muda de novo, e um botão no meio desse
 * laço obriga a confirmar algo que já está visível na tela.
 *
 * A aparência (tema, densidade, movimento) tem página própria: `/aparencia`.
 */
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import type { AtualizarPreferencias } from '@norbit/contracts';
import { MolduraDeConfiguracoes } from '../../configuracoes/moldura-de-configuracoes';
import { Aviso } from '../../ui/aviso';
import { Campo } from '../../ui/campo';
import { CartaoDeSecao } from '../../ui/cartao-de-secao';
import { ToastService } from '../../ui/toast.service';
import { PreferenciasService } from '../preferencias.service';

@Component({
  selector: 'nb-preferencias',
  imports: [Aviso, Campo, CartaoDeSecao, MolduraDeConfiguracoes],
  templateUrl: './preferencias.html',
  styleUrl: './preferencias.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Preferencias {
  private readonly api = inject(PreferenciasService);
  private readonly toasts = inject(ToastService);

  protected readonly atuais = this.api.preferencias;
  protected readonly erro = signal<string | null>(null);

  protected readonly visoes = [
    { valor: 'MONTH' as const, rotulo: 'Mês' },
    { valor: 'WEEK' as const, rotulo: 'Semana' },
    { valor: 'DAY' as const, rotulo: 'Dia' },
  ];

  protected readonly diasDaSemana = [
    { valor: 0, rotulo: 'Domingo' },
    { valor: 1, rotulo: 'Segunda' },
  ];

  constructor() {
    // Recarrega ao abrir: a tela pode ter sido alcançada por URL, sem passar
    // pelo calendário que já havia carregado.
    this.api.carregar().subscribe({
      error: () =>
        this.erro.set('Não foi possível carregar suas preferências.'),
    });
  }

  protected alterar(dados: AtualizarPreferencias): void {
    this.erro.set(null);

    this.api.atualizar(dados).subscribe({
      next: () => this.toasts.mostrar('Preferências salvas.'),
      error: () => {
        // Sem reverter à mão: o sinal continua com o que o servidor confirmou
        // por último, e o template lê dele. O que a pessoa tentou simplesmente
        // não vale.
        this.erro.set('Não foi possível salvar. A preferência não mudou.');
      },
    });
  }

  protected alterarInicioDaSemana(valor: string): void {
    this.alterar({ weekStartsOn: Number(valor) });
  }
}

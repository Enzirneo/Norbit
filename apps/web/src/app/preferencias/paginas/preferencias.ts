/**
 * A tela de preferências.
 *
 * Salva **a cada alteração**, e não num botão "salvar". Preferência é ajuste
 * fino: a pessoa muda, olha o resultado e muda de novo, e um botão no meio desse
 * laço obriga a confirmar algo que já está visível na tela.
 *
 * A consequência é que o erro precisa aparecer sem interromper — por isso ele é
 * uma linha, e o valor volta ao que o servidor confirmou.
 */
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import type { AtualizarPreferencias } from '@norbit/contracts';
import { ACENTOS, type NomeDeAcento } from '@norbit/design-tokens';
import { Botao } from '../../ui/botao';
import { Campo } from '../../ui/campo';
import { Marca } from '../../ui/marca';
import { PreferenciasService } from '../preferencias.service';

type OpcaoDeAcento = { readonly nome: NomeDeAcento; readonly cor: string };

const ROTULOS_DE_ACENTO: Record<NomeDeAcento, string> = {
  nebula: 'Nebulosa',
  aurora: 'Aurora',
  solar: 'Solar',
  pulsar: 'Pulsar',
  cosmos: 'Cosmos',
};

@Component({
  selector: 'nb-preferencias',
  imports: [Botao, Campo, Marca],
  templateUrl: './preferencias.html',
  styleUrl: './preferencias.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Preferencias {
  private readonly api = inject(PreferenciasService);
  private readonly router = inject(Router);

  protected readonly atuais = this.api.preferencias;
  protected readonly salvando = signal(false);
  protected readonly erro = signal<string | null>(null);

  protected readonly acentos: readonly OpcaoDeAcento[] = (
    Object.keys(ACENTOS) as NomeDeAcento[]
  ).map((nome) => ({ nome, cor: ACENTOS[nome] }));

  protected readonly densidades = [
    { valor: 0, rotulo: 'Compacta' },
    { valor: 1, rotulo: 'Confortável' },
    { valor: 2, rotulo: 'Espaçosa' },
  ];

  protected readonly visoes = [
    { valor: 'MONTH' as const, rotulo: 'Mês' },
    { valor: 'WEEK' as const, rotulo: 'Semana' },
    { valor: 'DAY' as const, rotulo: 'Dia' },
  ];

  protected readonly diasDaSemana = [
    { valor: 0, rotulo: 'Domingo' },
    { valor: 1, rotulo: 'Segunda' },
  ];

  protected readonly rotuloDoAcento = computed(() => {
    const atual = this.acentos.find((a) => a.cor === this.atuais().accentColor);
    return atual ? ROTULOS_DE_ACENTO[atual.nome] : 'Personalizada';
  });

  constructor() {
    // Recarrega ao abrir: a tela pode ter sido alcançada por URL, sem passar
    // pelo calendário que já havia carregado.
    this.api.carregar().subscribe({
      error: () =>
        this.erro.set('Não foi possível carregar suas preferências.'),
    });
  }

  protected rotuloDe(nome: NomeDeAcento): string {
    return ROTULOS_DE_ACENTO[nome];
  }

  protected alterar(dados: AtualizarPreferencias): void {
    this.salvando.set(true);
    this.erro.set(null);

    this.api.atualizar(dados).subscribe({
      next: () => this.salvando.set(false),
      error: () => {
        this.salvando.set(false);
        // Sem reverter à mão: o sinal continua com o que o servidor confirmou
        // por último, e o template lê dele. O que a pessoa tentou simplesmente
        // não vale.
        this.erro.set('Não foi possível salvar. A preferência não mudou.');
      },
    });
  }

  protected alterarDensidade(valor: string): void {
    this.alterar({ density: Number(valor) });
  }

  protected alterarInicioDaSemana(valor: string): void {
    this.alterar({ weekStartsOn: Number(valor) });
  }

  protected voltar(): void {
    void this.router.navigateByUrl('/');
  }
}

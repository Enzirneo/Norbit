/**
 * Os aparelhos com a conta aberta, dentro da tela de perfil.
 *
 * Quem desconfia de acesso alheio (ou esqueceu a conta aberta numa máquina
 * emprestada) derruba o aparelho daqui, sem precisar trocar a senha. O aparelho
 * atual não tem botão: encerrá-lo é o "Sair".
 */
import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import type { SessaoAtiva } from '@norbit/contracts';
import { errosDaApi } from '../auth/erros-de-formulario';
import { Botao } from '../ui/botao';
import { descreverAparelho } from './descrever-aparelho';
import { SessoesService } from './sessoes.service';

@Component({
  selector: 'nb-sessoes-ativas',
  imports: [DatePipe, Botao],
  templateUrl: './sessoes-ativas.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessoesAtivas {
  private readonly servico = inject(SessoesService);

  protected readonly sessoes = signal<readonly SessaoAtiva[]>([]);
  protected readonly carregando = signal(true);
  protected readonly revogando = signal<string | null>(null);
  protected readonly erro = signal<string | null>(null);

  constructor() {
    this.carregar();
  }

  protected rotulo(sessao: SessaoAtiva): string {
    return descreverAparelho(sessao.userAgent);
  }

  protected desconectar(sessao: SessaoAtiva): void {
    this.erro.set(null);
    this.revogando.set(sessao.id);

    this.servico.revogar(sessao.id).subscribe({
      next: () => {
        this.revogando.set(null);
        // Sai da lista sem refazer o pedido: o servidor já confirmou.
        this.sessoes.update((lista) => lista.filter((s) => s.id !== sessao.id));
      },
      error: (falha: unknown) => {
        this.revogando.set(null);
        this.erro.set(mensagemDe(falha));
        // Um 404 quer dizer que o aparelho já tinha saído: a lista estava velha.
        this.carregar();
      },
    });
  }

  private carregar(): void {
    this.servico.listar().subscribe({
      next: (lista) => {
        this.sessoes.set(lista);
        this.carregando.set(false);
      },
      error: (falha: unknown) => {
        this.carregando.set(false);
        this.erro.set(mensagemDe(falha));
      },
    });
  }
}

function mensagemDe(falha: unknown): string {
  return errosDaApi(falha)['formulario'] ?? 'Não foi possível carregar.';
}

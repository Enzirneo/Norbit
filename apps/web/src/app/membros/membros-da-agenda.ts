/**
 * Quem está numa agenda, para o dono mudar o papel ou tirar alguém.
 *
 * O dono aparece na lista mas não é editável: posse se transfere, não se
 * rebaixa. Remover e transferir a posse pedem uma segunda confirmação na
 * própria linha — são as ações daqui que a pessoa não desfaz sozinha.
 */
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import type { MembroVisivel } from '@norbit/contracts';
import { errosDaApi } from '../auth/erros-de-formulario';
import { PAPEIS_CONVIDAVEIS, type PapelConvidavel } from '../convites/papel';
import { Botao } from '../ui/botao';
import { MembrosService } from './membros.service';
import { Aviso } from '../ui/aviso';
import { Avatar } from '../ui/avatar';
import { Etiqueta } from '../ui/etiqueta';

/** A ação que espera confirmação, e para quem. */
type Pendente = {
  readonly userId: string;
  readonly acao: 'remover' | 'transferir';
};

@Component({
  selector: 'nb-membros-da-agenda',
  imports: [Etiqueta, Avatar, Aviso, Botao],
  templateUrl: './membros-da-agenda.html',
  styleUrl: './membros-da-agenda.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MembrosDaAgenda implements OnInit {
  private readonly membrosApi = inject(MembrosService);

  readonly calendarId = input.required<string>();
  /** A agenda padrão é pessoal e a API não a transfere: a tela nem oferece. */
  readonly podeTransferir = input(false);
  /** Avisa quem hospeda, porque o papel de quem está logado acabou de mudar. */
  readonly posseTransferida = output<void>();

  protected readonly papeis = PAPEIS_CONVIDAVEIS;

  protected readonly membros = signal<readonly MembroVisivel[]>([]);
  protected readonly carregando = signal(true);
  protected readonly erro = signal<string | null>(null);
  /** A ação que espera confirmação, ou `null`. */
  protected readonly pendente = signal<Pendente | null>(null);

  ngOnInit(): void {
    this.recarregar();
  }

  protected mudarPapel(membro: MembroVisivel, evento: Event): void {
    const papel = (evento.target as HTMLSelectElement).value as PapelConvidavel;
    this.erro.set(null);

    this.membrosApi
      .definirPapel(this.calendarId(), membro.userId, papel)
      .subscribe({
        next: () => this.recarregar(),
        error: (e: unknown) => {
          this.erro.set(mensagemDe(e));
          // O seletor já mostra o valor novo; recarregar o devolve ao real.
          this.recarregar();
        },
      });
  }

  protected pedirConfirmacao(
    membro: MembroVisivel,
    acao: Pendente['acao'],
  ): void {
    this.pendente.set({ userId: membro.userId, acao });
  }

  protected cancelar(): void {
    this.pendente.set(null);
  }

  protected aguardando(membro: MembroVisivel, acao: Pendente['acao']): boolean {
    const atual = this.pendente();
    return atual?.userId === membro.userId && atual.acao === acao;
  }

  protected remover(membro: MembroVisivel): void {
    this.erro.set(null);
    this.pendente.set(null);

    this.membrosApi.remover(this.calendarId(), membro.userId).subscribe({
      next: () => {
        this.membros.update((lista) =>
          lista.filter((m) => m.userId !== membro.userId),
        );
      },
      error: (e: unknown) => this.erro.set(mensagemDe(e)),
    });
  }

  protected transferir(membro: MembroVisivel): void {
    this.erro.set(null);
    this.pendente.set(null);

    this.membrosApi
      .transferirPosse(this.calendarId(), membro.userId)
      .subscribe({
        next: () => this.posseTransferida.emit(),
        error: (e: unknown) => this.erro.set(mensagemDe(e)),
      });
  }

  private recarregar(): void {
    this.membrosApi.listar(this.calendarId()).subscribe({
      next: (lista) => {
        this.membros.set(lista);
        this.carregando.set(false);
      },
      error: (e: unknown) => {
        this.carregando.set(false);
        this.erro.set(mensagemDe(e));
      },
    });
  }
}

function mensagemDe(erro: unknown): string {
  return errosDaApi(erro)['formulario'] ?? 'Não foi possível concluir.';
}

/**
 * Quem está numa agenda, para o dono mudar o papel ou tirar alguém.
 *
 * O dono aparece na lista mas não é editável: posse se transfere, não se
 * rebaixa. Remover pede uma segunda confirmação na própria linha — é a única
 * ação daqui que a pessoa removida não consegue desfazer sozinha.
 */
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  input,
  signal,
} from '@angular/core';
import type { MembroVisivel } from '@norbit/contracts';
import { errosDaApi } from '../auth/erros-de-formulario';
import { PAPEIS_CONVIDAVEIS, type PapelConvidavel } from '../convites/papel';
import { iniciaisDe } from '../perfil/iniciais';
import { Botao } from '../ui/botao';
import { MembrosService } from './membros.service';

@Component({
  selector: 'nb-membros-da-agenda',
  imports: [Botao],
  templateUrl: './membros-da-agenda.html',
  styleUrl: './membros-da-agenda.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MembrosDaAgenda implements OnInit {
  private readonly membrosApi = inject(MembrosService);

  readonly calendarId = input.required<string>();

  protected readonly papeis = PAPEIS_CONVIDAVEIS;
  protected readonly iniciaisDe = iniciaisDe;

  protected readonly membros = signal<readonly MembroVisivel[]>([]);
  protected readonly carregando = signal(true);
  protected readonly erro = signal<string | null>(null);
  /** O membro cuja remoção espera confirmação, ou `null`. */
  protected readonly confirmando = signal<string | null>(null);

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

  protected pedirConfirmacao(membro: MembroVisivel): void {
    this.confirmando.set(membro.userId);
  }

  protected cancelar(): void {
    this.confirmando.set(null);
  }

  protected remover(membro: MembroVisivel): void {
    this.erro.set(null);
    this.confirmando.set(null);

    this.membrosApi.remover(this.calendarId(), membro.userId).subscribe({
      next: () => {
        this.membros.update((lista) =>
          lista.filter((m) => m.userId !== membro.userId),
        );
      },
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

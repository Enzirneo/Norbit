/**
 * O painel do dono para convidar gente para uma agenda.
 *
 * Três coisas numa tela: criar (por e-mail ou por link), ver o que está
 * pendente e revogar. O que torna o painel diferente de uma lista comum é o
 * **link recém-criado**: a API guarda só o hash do token, então o link existe
 * nesta resposta e em nenhum outro lugar. A tela o mostra de forma que não dá
 * para perder sem querer, e o esquece ao fechar.
 */
import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import type { ConviteCriado, ConviteVisivel } from '@norbit/contracts';
import {
  errosDaApi,
  errosDoZod,
  type ErrosPorCampo,
} from '../auth/erros-de-formulario';
import { Botao } from '../ui/botao';
import { Campo } from '../ui/campo';
import { ConvitesService } from './convites.service';
import {
  PAPEIS_CONVIDAVEIS,
  rotuloDoPapel,
  type PapelConvidavel,
} from './papel';
import { validarConvite } from './validar-convite';

@Component({
  selector: 'nb-painel-de-convites',
  imports: [ReactiveFormsModule, DatePipe, Campo, Botao],
  templateUrl: './painel-de-convites.html',
  styleUrl: './painel-de-convites.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PainelDeConvites implements OnInit {
  private readonly convites = inject(ConvitesService);
  private readonly fb = inject(FormBuilder);

  readonly calendarId = input.required<string>();

  protected readonly papeis = PAPEIS_CONVIDAVEIS;
  protected readonly rotuloDoPapel = rotuloDoPapel;

  protected readonly formulario = this.fb.group({
    email: this.fb.nonNullable.control(''),
    // O menor privilégio como padrão: quem convida deve escolher dar mais,
    // e não esquecer de dar menos.
    papel: this.fb.nonNullable.control<PapelConvidavel>('VIEWER'),
    validadeDias: this.fb.control<number | null>(7),
    usosMaximos: this.fb.control<number | null>(null),
  });

  protected readonly pendentes = signal<readonly ConviteVisivel[]>([]);
  protected readonly carregando = signal(true);
  protected readonly enviando = signal(false);
  protected readonly erros = signal<ErrosPorCampo>({});
  protected readonly criado = signal<ConviteCriado | null>(null);
  protected readonly copiado = signal(false);

  ngOnInit(): void {
    this.recarregar();
  }

  /** Sem e-mail o convite é um link, e é aí que o teto de usos faz sentido. */
  protected porLink(): boolean {
    return this.formulario.controls.email.value.trim() === '';
  }

  protected criar(): void {
    const validado = validarConvite(this.formulario.getRawValue());

    if (!validado.success) {
      this.erros.set(errosDoZod(validado.error));
      return;
    }

    this.erros.set({});
    this.criado.set(null);
    this.enviando.set(true);

    this.convites.criar(this.calendarId(), validado.data).subscribe({
      next: (resultado) => {
        this.enviando.set(false);
        this.criado.set(resultado);
        this.copiado.set(false);
        this.formulario.controls.email.reset('');
        this.recarregar();
      },
      error: (erro: unknown) => {
        this.enviando.set(false);
        this.erros.set(errosDaApi(erro));
      },
    });
  }

  protected revogar(convite: ConviteVisivel): void {
    this.convites.revogar(this.calendarId(), convite.id).subscribe({
      next: () => {
        this.pendentes.update((lista) =>
          lista.filter((c) => c.id !== convite.id),
        );
      },
      error: (erro: unknown) => this.erros.set(errosDaApi(erro)),
    });
  }

  protected async copiar(link: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(link);
      this.copiado.set(true);
    } catch {
      // Sem permissão para a área de transferência (HTTP, iframe): o campo
      // continua selecionável, e a pessoa copia à mão.
      this.copiado.set(false);
    }
  }

  protected selecionar(evento: Event): void {
    (evento.target as HTMLInputElement).select();
  }

  private recarregar(): void {
    this.convites.listar(this.calendarId()).subscribe({
      next: (lista) => {
        this.pendentes.set(lista);
        this.carregando.set(false);
      },
      error: (erro: unknown) => {
        this.carregando.set(false);
        this.erros.set(errosDaApi(erro));
      },
    });
  }
}

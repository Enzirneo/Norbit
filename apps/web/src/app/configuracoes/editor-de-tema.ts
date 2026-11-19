/**
 * O editor de tema: as sementes de cor e a forma, com prévia ao vivo no app todo.
 *
 * O que se edita é um **rascunho**. Cada alteração vira prévia (os tokens são
 * variáveis CSS, e a lua lê `temaVigente`), mas só "Salvar" grava na conta; sair
 * sem salvar desfaz. O motor (`derivar`) garante o contraste, e quando precisa
 * ajustar uma semente o aviso aparece junto das cores que o causaram.
 */
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { TEMA_PADRAO, type Tema } from '@norbit/contracts';
import {
  ACENTOS,
  TEMAS_PRONTOS,
  derivar,
  type NomeDeAcento,
  type NomeDeTemaPronto,
} from '@norbit/design-tokens';
import { PreferenciasService } from '../preferencias/preferencias.service';
import { Aviso } from '../ui/aviso';
import { Botao } from '../ui/botao';
import { Campo } from '../ui/campo';
import { ToastService } from '../ui/toast.service';

const ROTULOS_DE_ACENTO: Record<NomeDeAcento, string> = {
  nebula: 'Nebulosa',
  aurora: 'Aurora',
  solar: 'Solar',
  pulsar: 'Pulsar',
  cosmos: 'Cosmos',
};

@Component({
  selector: 'nb-editor-de-tema',
  imports: [Aviso, Botao, Campo],
  templateUrl: './editor-de-tema.html',
  styleUrl: './editor-de-tema.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorDeTema {
  private readonly servico = inject(PreferenciasService);
  private readonly toasts = inject(ToastService);

  /** O que está sendo editado. Começa igual ao da conta. */
  protected readonly rascunho = signal<Tema>(this.servico.preferencias().tema);
  protected readonly salvando = signal(false);
  protected readonly erro = signal<string | null>(null);

  protected readonly sujo = computed(
    () =>
      JSON.stringify(this.rascunho()) !==
      JSON.stringify(this.servico.preferencias().tema),
  );

  protected readonly avisosDoMotor = computed(
    () => derivar(this.rascunho().sementes).avisos,
  );

  /** Cada tema pronto com os tokens que ele deriva, para a miniatura. */
  protected readonly galeria = (
    Object.keys(TEMAS_PRONTOS) as NomeDeTemaPronto[]
  ).map((nome) => ({ nome, tokens: derivar(TEMAS_PRONTOS[nome]).tokens }));

  protected readonly atalhos = (Object.keys(ACENTOS) as NomeDeAcento[]).map(
    (nome) => ({ nome, rotulo: ROTULOS_DE_ACENTO[nome], cor: ACENTOS[nome] }),
  );

  constructor() {
    effect(() =>
      this.servico.definirPrevia(this.sujo() ? this.rascunho() : null),
    );

    inject(DestroyRef).onDestroy(() => this.servico.definirPrevia(null));
  }

  protected escolherPronto(nome: NomeDeTemaPronto): void {
    this.rascunho.update((t) => ({
      ...t,
      base: nome,
      sementes: { ...TEMAS_PRONTOS[nome] },
    }));
  }

  protected mudarSemente(campo: 'fundo' | 'destaque', cor: string): void {
    this.rascunho.update((t) => ({
      ...t,
      base: null,
      sementes: { ...t.sementes, [campo]: cor.toLowerCase() },
    }));
  }

  protected alternarContrasteAlto(alto: boolean): void {
    this.rascunho.update((t) => ({
      ...t,
      sementes: { ...t.sementes, contraste: alto ? 'alto' : 'normal' },
    }));
  }

  protected mudarCantos(valor: string): void {
    this.mudarForma({ cantos: Number(valor) });
  }

  protected alternarEstrelas(ligadas: boolean): void {
    this.mudarForma({ estrelas: ligadas });
  }

  protected alternarLua(ligada: boolean): void {
    this.mudarForma({ lua: ligada });
  }

  protected mudarHemisferio(valor: string): void {
    this.mudarForma({ hemisferio: valor === 'norte' ? 'norte' : 'sul' });
  }

  protected restaurar(): void {
    this.rascunho.set(TEMA_PADRAO);
  }

  protected desfazer(): void {
    this.rascunho.set(this.servico.preferencias().tema);
  }

  protected salvar(): void {
    this.erro.set(null);
    this.salvando.set(true);

    this.servico.atualizar({ tema: this.rascunho() }).subscribe({
      next: () => {
        this.salvando.set(false);
        this.toasts.mostrar('Tema salvo.');
      },
      error: () => {
        this.salvando.set(false);
        this.erro.set('Não foi possível salvar o tema. Nada mudou.');
      },
    });
  }

  private mudarForma(parte: Partial<Tema['forma']>): void {
    this.rascunho.update((t) => ({ ...t, forma: { ...t.forma, ...parte } }));
  }
}

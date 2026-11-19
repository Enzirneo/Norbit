/**
 * As visões de semana e dia.
 *
 * Um componente só para as duas: a diferença é a quantidade de colunas, e
 * duplicá-lo criaria dois lugares para corrigir o mesmo defeito de posicionamento.
 *
 * Nenhuma conta de tempo aqui. Onde cada faixa começa e que altura tem vem de
 * `faixaNoDia`; quem divide espaço com quem, de `distribuirColunas`; e as marcas
 * de hora, de `horasDoDia` — as três em `libs/domain`, testadas sem navegador,
 * porque é onde mora a armadilha de o dia não ter sempre 24 horas.
 */
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterRenderEffect,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import type { AgendaVisivel, OcorrenciaVisivel } from '@norbit/contracts';
import {
  celulaDaGrade,
  distribuirColunas,
  faixaNoDia,
  faixasDaSemana,
  faseDoDia,
  horasDoDia,
  instanteNaGrade,
  intervaloDosDias,
  podeNoItem,
  type DataCivil,
  type Horario,
} from '@norbit/domain';
import {
  celulasDeHora,
  type CelulaDeHora,
  comoTexto,
  corDaAgenda,
  fracaoDoPassado,
  horarioDe,
  mesmoDia,
  rotuloCurtoDe,
  rotuloDeHora,
} from './apoio-da-grade';
import { Lua } from '../ui/lua';
import { GestoDeArrasto, type ModoDeArrasto } from './gesto-de-arrasto';

/**
 * A hora em que a grade abre quando a tela não mostra hoje.
 *
 * Abrir à meia-noite mostra oito horas em que quase ninguém marca nada, e o dia
 * útil começa abaixo da dobra.
 */
const HORA_INICIAL_SEM_HOJE = 7;

/** De quanto em quanto tempo a linha de agora se move. */
const PASSO_DA_LINHA_DE_AGORA = 60_000;

type FaixaComHora = {
  readonly chave: string;
  readonly ocorrencia: OcorrenciaVisivel;
  /** A cor da agenda: vira `--c` no CSS, de onde saem a barra e o fundo. */
  readonly cor: string;
  /** Porcentagens, prontas para `top`, `height`, `left` e `width`. */
  readonly topo: number;
  readonly altura: number;
  readonly esquerda: number;
  readonly largura: number;
  readonly horario: string;
  /** Quem vê pode mudar o horário arrastando: o papel permite editar este evento. */
  readonly arrastavel: boolean;
  /** Este trecho contém o fim do evento; só nele cabe a alça de redimensionar. */
  readonly terminaNoDia: boolean;
};

/** O horário provisório de uma ocorrência enquanto ela é arrastada. */
type Arrasto = {
  readonly chave: string;
  readonly horario: Horario;
};

/** O que a tela pede à página quando um arrasto termina com mudança. */
export type Reagendamento = {
  readonly ocorrencia: OcorrenciaVisivel;
  readonly inicio: Date;
  readonly fim: Date;
};

type Coluna = {
  readonly dia: DataCivil;
  readonly rotuloCurto: string;
  readonly numero: number;
  readonly ehHoje: boolean;
  readonly horas: readonly CelulaDeHora[];
  readonly faixas: readonly FaixaComHora[];
  /** Posição da linha de agora, em porcentagem, ou `null` se não é hoje. */
  readonly agora: number | null;
  /** Quanto da coluna, de cima para baixo, já é passado (0 a 100). */
  readonly passado: number;
  /** A fase da lua do dia, de 0 a 1. */
  readonly fase: number;
};

type FaixaDeDiaInteiro = {
  readonly chave: string;
  readonly ocorrencia: OcorrenciaVisivel;
  readonly cor: string;
  readonly coluna: number;
  readonly colunas: number;
  readonly trilha: number;
};

@Component({
  selector: 'nb-visao-de-horas',
  imports: [Lua],
  templateUrl: './visao-de-horas.html',
  styleUrl: './visao-de-horas.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VisaoDeHoras {
  readonly dias = input.required<readonly DataCivil[]>();
  readonly ocorrencias = input.required<readonly OcorrenciaVisivel[]>();
  readonly agendas = input.required<readonly AgendaVisivel[]>();
  readonly fuso = input.required<string>();
  readonly hoje = input.required<DataCivil>();
  /** Relógio de 24 horas, da preferência da conta. */
  readonly vinteEQuatroHoras = input.required<boolean>();
  /** Quem está vendo: o papel `CONTRIBUTOR` só mexe nos eventos que criou. */
  readonly usuarioId = input.required<string>();

  readonly selecionada = output<OcorrenciaVisivel>();
  /** O dia e a hora clicados no espaço vazio da grade. */
  readonly horaSelecionada = output<{ dia: string; hora: string }>();
  /** Um arrasto ou redimensionamento terminou com um horário novo. */
  readonly reagendada = output<Reagendamento>();

  private readonly gradeRef = viewChild<ElementRef<HTMLElement>>('grade');
  private readonly rolagemRef = viewChild<ElementRef<HTMLElement>>('rolagem');

  /**
   * O horário provisório da ocorrência em arrasto.
   *
   * Continua depois de soltar, até a página recarregar as ocorrências: soltar
   * já gravou na API, e voltar o evento ao lugar antigo por um instante antes
   * de ele pular para o novo seria um piscar.
   */
  protected readonly arrasto = signal<Arrasto | null>(null);

  private readonly gesto = new GestoDeArrasto((x, y) =>
    this.instanteDoPonteiro(x, y),
  );
  private arrastada: OcorrenciaVisivel | null = null;
  private houveArrasto = false;

  /**
   * O instante de agora, atualizado de minuto em minuto.
   *
   * Um sinal, e não `new Date()` lido no template: no template ele seria
   * recalculado a cada detecção de mudança e a linha nunca estabilizaria — nem
   * seria possível saber quando ela se move.
   */
  private readonly agora = signal(new Date());

  /** As horas visíveis, para o eixo da esquerda. Vêm do primeiro dia. */
  protected readonly eixo = computed(() => {
    const primeiro = this.dias()[0];
    const marcas = primeiro ? horasDoDia(primeiro, this.fuso()) : [];

    // A marca da fração 0 é a borda de cima da grade: o rótulo, centrado no
    // traço, ficava com metade para fora, cortado. Ela fica sem rótulo, como nos
    // calendários que a pessoa já conhece; o traço de cima continua lá.
    return marcas
      .filter((marca) => marca.posicao > 0)
      .map((marca) => ({
        ...marca,
        texto: rotuloDeHora(marca.hora, this.vinteEQuatroHoras()),
      }));
  });

  protected readonly colunas = computed<readonly Coluna[]>(() => {
    const cores = new Map(this.agendas().map((a) => [a.id, a.color]));
    const comHora = this.comArrastoAplicado().filter((o) => !o.isAllDay);

    return this.dias().map((dia) => this.montarColuna(dia, comHora, cores));
  });

  /**
   * As faixas de dia inteiro, numa tira acima da grade.
   *
   * Reusa o empilhamento da visão de mês: a tira é uma semana de uma linha só, e
   * o problema de duas barras compartilharem um dia é o mesmo.
   */
  protected readonly diaInteiro = computed<readonly FaixaDeDiaInteiro[]>(() => {
    const cores = new Map(this.agendas().map((a) => [a.id, a.color]));
    const porChave = new Map(
      this.ocorrencias()
        .filter((o) => o.isAllDay)
        .map((o) => [chaveDa(o), o] as const),
    );

    const celulas = this.dias().map((dia) => ({ ...dia, noMes: true }));
    const { faixas } = faixasDaSemana(
      celulas,
      [...porChave].map(([chave, o]) => ({
        id: chave,
        inicio: new Date(o.inicio),
        fim: new Date(o.fim),
      })),
      this.fuso(),
    );

    return faixas.flatMap((faixa) => {
      const ocorrencia = porChave.get(faixa.id);
      if (!ocorrencia) {
        return [];
      }

      return [
        {
          chave: faixa.id,
          ocorrencia,
          cor: corDaAgenda(cores.get(ocorrencia.calendarId)),
          coluna: faixa.de + 1,
          colunas: faixa.ate - faixa.de + 1,
          trilha: faixa.trilha,
        },
      ];
    });
  });

  protected readonly trilhasDeDiaInteiro = computed(() =>
    this.diaInteiro().reduce((maior, f) => Math.max(maior, f.trilha + 1), 0),
  );

  constructor() {
    const relogio = setInterval(
      () => this.agora.set(new Date()),
      PASSO_DA_LINHA_DE_AGORA,
    );

    // A grade abre onde a pessoa vai olhar, e não no topo. Depende só dos dias
    // na tela: rolar de novo a cada minuto (a linha de agora se move) ou a cada
    // recarga de eventos tiraria a grade de debaixo de quem está usando.
    afterRenderEffect(() => {
      const rolagem = this.rolagemRef()?.nativeElement;
      this.dias();

      if (rolagem) {
        untracked(() => this.rolarParaOHorarioUtil(rolagem));
      }
    });

    // Chegaram ocorrências novas (a página recarregou depois de gravar, ou
    // falhou e recarregou para desfazer): o horário provisório já cumpriu o papel.
    effect(() => {
      this.ocorrencias();
      untracked(() => this.arrasto.set(null));
    });

    inject(DestroyRef).onDestroy(() => {
      clearInterval(relogio);
      this.encerrarEscuta();
    });
  }

  /**
   * Começa um arrasto (ou um clique: só passado o limiar ele vira arrasto).
   *
   * O botão do mouse e a caneta; o toque fica de fora porque arrastar com o
   * dedo brigaria com a rolagem da grade. Quem não pode usar o ponteiro tem o
   * formulário: clicar no evento abre os campos de início e fim.
   */
  protected iniciarArrasto(evento: PointerEvent, faixa: FaixaComHora): void {
    if (
      !faixa.arrastavel ||
      evento.button !== 0 ||
      evento.pointerType === 'touch' ||
      !this.gradeRef()
    ) {
      return;
    }

    const alvo = evento.target;
    const modo: ModoDeArrasto =
      alvo instanceof Element && alvo.closest('.alca')
        ? 'redimensionar'
        : 'mover';

    this.arrastada = faixa.ocorrencia;
    this.houveArrasto = false;
    this.gesto.iniciar({
      x: evento.clientX,
      y: evento.clientY,
      modo,
      inicio: new Date(faixa.ocorrencia.inicio),
      fim: new Date(faixa.ocorrencia.fim),
    });

    window.addEventListener('pointermove', this.aoMoverPonteiro);
    window.addEventListener('pointerup', this.aoSoltarPonteiro);
    window.addEventListener('pointercancel', this.aoSoltarPonteiro);
    window.addEventListener('keydown', this.aoTeclar);
  }

  /** `AAAA-MM-DD` do dia, que é o que o formulário recebe. */
  protected comoTexto(dia: DataCivil): string {
    return comoTexto(dia);
  }

  /**
   * Hoje na tela: a hora de agora fica um terço abaixo do topo, com o passado
   * recente acima e o que vem a seguir embaixo. Sem hoje: as 7h perto do topo.
   */
  private rolarParaOHorarioUtil(rolagem: HTMLElement): void {
    const agora = this.colunas().find((c) => c.agora !== null)?.agora ?? null;
    const fracaoDasSete =
      this.eixo().find((m) => m.hora === HORA_INICIAL_SEM_HOJE)?.posicao ??
      HORA_INICIAL_SEM_HOJE / 24;

    const alvo =
      (agora === null ? fracaoDasSete : agora / 100) * rolagem.scrollHeight;
    const recuo =
      agora === null ? rolagem.clientHeight * 0.05 : rolagem.clientHeight / 3;

    rolagem.scrollTop = Math.max(0, alvo - recuo);
  }

  private readonly aoMoverPonteiro = (evento: PointerEvent): void => {
    const horario = this.gesto.mover(evento.clientX, evento.clientY);

    if (horario && this.arrastada) {
      this.houveArrasto = true;
      this.arrasto.set({ chave: chaveDa(this.arrastada), horario });
    }
  };

  private readonly aoSoltarPonteiro = (): void => {
    const { intervalo } = this.gesto.soltar();
    const ocorrencia = this.arrastada;
    const arrastou = this.houveArrasto;
    this.encerrarEscuta();

    // O navegador dispara um clique ao soltar sobre o mesmo botão, e abrir o
    // formulário no fim de um arrasto seria o oposto do que a pessoa quis.
    if (arrastou) {
      engolirOProximoClique();
    }

    if (ocorrencia && intervalo) {
      this.reagendada.emit({ ocorrencia, ...intervalo });
    } else {
      this.arrasto.set(null);
    }
  };

  /** Esc desiste do arrasto, mas o gesto só termina quando o botão é solto. */
  private readonly aoTeclar = (evento: KeyboardEvent): void => {
    if (evento.key === 'Escape') {
      this.gesto.cancelar();
      this.arrasto.set(null);
    }
  };

  private encerrarEscuta(): void {
    window.removeEventListener('pointermove', this.aoMoverPonteiro);
    window.removeEventListener('pointerup', this.aoSoltarPonteiro);
    window.removeEventListener('pointercancel', this.aoSoltarPonteiro);
    window.removeEventListener('keydown', this.aoTeclar);
  }

  /** O instante sob um ponto da tela, a partir da posição da grade agora. */
  private instanteDoPonteiro(x: number, y: number): Date {
    const caixa = this.gradeRef()?.nativeElement.getBoundingClientRect();
    const dias = this.dias();
    const { coluna, fracao } = celulaDaGrade({
      x,
      y,
      esquerda: caixa?.left ?? 0,
      topo: caixa?.top ?? 0,
      largura: caixa?.width ?? 0,
      altura: caixa?.height ?? 0,
      colunas: dias.length,
    });

    return instanteNaGrade({ dia: dias[coluna], fuso: this.fuso(), fracao });
  }

  /** As ocorrências, com a que está em arrasto já no horário provisório. */
  private comArrastoAplicado(): readonly OcorrenciaVisivel[] {
    const arrasto = this.arrasto();
    if (!arrasto) {
      return this.ocorrencias();
    }

    return this.ocorrencias().map((o) =>
      chaveDa(o) === arrasto.chave
        ? {
            ...o,
            inicio: arrasto.horario.inicio.toISOString(),
            fim: arrasto.horario.fim.toISOString(),
          }
        : o,
    );
  }

  private podeArrastar(ocorrencia: OcorrenciaVisivel): boolean {
    const agenda = this.agendas().find((a) => a.id === ocorrencia.calendarId);

    return (
      agenda !== undefined &&
      podeNoItem({
        papel: agenda.papel,
        acao: 'editar-evento',
        ehAutor: ocorrencia.createdById === this.usuarioId(),
      })
    );
  }

  private montarColuna(
    dia: DataCivil,
    comHora: readonly OcorrenciaVisivel[],
    cores: ReadonlyMap<string, string>,
  ): Coluna {
    const agora = this.posicaoDeAgora(dia);

    return {
      dia,
      rotuloCurto: rotuloCurtoDe(dia),
      numero: dia.dia,
      ehHoje: mesmoDia(dia, this.hoje()),
      horas: celulasDeHora(
        dia,
        horasDoDia(dia, this.fuso()),
        this.vinteEQuatroHoras(),
      ),
      faixas: this.faixasDoDia(dia, comHora, cores),
      agora,
      passado: fracaoDoPassado(dia, this.hoje(), agora),
      fase: faseDoDia(dia),
    };
  }

  /**
   * As faixas de um dia, já com a coluna que cada uma ocupa.
   *
   * Separado de `montarColuna` quando a preferência de 24 horas entrou e o
   * método passou do limite de linhas: são duas responsabilidades — montar a
   * coluna e posicionar o que há dentro dela.
   */
  private faixasDoDia(
    dia: DataCivil,
    comHora: readonly OcorrenciaVisivel[],
    cores: ReadonlyMap<string, string>,
  ): readonly FaixaComHora[] {
    const posicoes = comHora.flatMap((ocorrencia) => {
      const faixa = faixaNoDia({
        dia,
        fuso: this.fuso(),
        inicio: new Date(ocorrencia.inicio),
        fim: new Date(ocorrencia.fim),
      });

      return faixa === null
        ? []
        : [{ id: chaveDa(ocorrencia), ocorrencia, ...faixa }];
    });

    const fechaODia = intervaloDosDias([dia], this.fuso()).ate.getTime();
    const emArrasto = this.arrasto()?.chave;
    const porChave = new Map(posicoes.map((p) => [p.id, p.ocorrencia]));
    const distribuidas = distribuirColunas(
      posicoes.map(({ id, topo, altura }) => ({ id, topo, altura })),
    );

    return distribuidas.flatMap((c) => {
      const ocorrencia = porChave.get(c.id);
      if (!ocorrencia) {
        return [];
      }

      return [
        {
          chave: c.id,
          ocorrencia,
          cor: corDaAgenda(cores.get(ocorrencia.calendarId)),
          topo: c.topo * 100,
          altura: c.altura * 100,
          esquerda: (c.coluna / c.colunas) * 100,
          largura: (1 / c.colunas) * 100,
          horario: horarioDe(
            ocorrencia,
            this.fuso(),
            this.vinteEQuatroHoras(),
            c.id === emArrasto,
          ),
          arrastavel: this.podeArrastar(ocorrencia),
          terminaNoDia: new Date(ocorrencia.fim).getTime() <= fechaODia,
        },
      ];
    });
  }

  /**
   * A linha de agora, só na coluna de hoje.
   *
   * Reusa `faixaNoDia` com um instante de duração zero: a posição de "agora" é o
   * mesmo cálculo de onde começa uma faixa, e refazê-lo à mão abriria espaço
   * para a linha e as faixas discordarem — justamente nos dias de virada.
   */
  private posicaoDeAgora(dia: DataCivil): number | null {
    if (!mesmoDia(dia, this.hoje())) {
      return null;
    }

    const instante = this.agora();
    const faixa = faixaNoDia({
      dia,
      fuso: this.fuso(),
      inicio: instante,
      fim: instante,
    });

    return faixa === null ? null : faixa.topo * 100;
  }
}

/** A identidade de uma instância: a linha mais o início original. Ver docs/08. */
function chaveDa(ocorrencia: OcorrenciaVisivel): string {
  return `${ocorrencia.id}|${ocorrencia.inicioOriginal}`;
}

/**
 * Descarta o próximo clique, que o navegador dispara ao soltar o botão.
 *
 * A escuta sai no turno seguinte: o clique chega no mesmo turno do `pointerup`,
 * e sem a remoção um clique legítimo logo depois seria engolido por engano.
 */
function engolirOProximoClique(): void {
  const engolir = (evento: Event): void => {
    evento.stopPropagation();
    evento.preventDefault();
  };

  window.addEventListener('click', engolir, { capture: true, once: true });
  setTimeout(() => window.removeEventListener('click', engolir, true));
}

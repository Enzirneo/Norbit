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
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import type { AgendaVisivel, OcorrenciaVisivel } from '@norbit/contracts';
import {
  distribuirColunas,
  faixaNoDia,
  faixasDaSemana,
  horasDoDia,
  type DataCivil,
  type MarcaDeHora,
} from '@norbit/domain';

/** De quanto em quanto tempo a linha de agora se move. */
const PASSO_DA_LINHA_DE_AGORA = 60_000;

type FaixaComHora = {
  readonly chave: string;
  readonly ocorrencia: OcorrenciaVisivel;
  readonly fundo: string;
  readonly borda: string;
  /** Porcentagens, prontas para `top`, `height`, `left` e `width`. */
  readonly topo: number;
  readonly altura: number;
  readonly esquerda: number;
  readonly largura: number;
  readonly horario: string;
};

/** Uma hora clicável, posicionada pela fração real daquele dia. */
type CelulaDeHora = {
  readonly hora: number;
  readonly topo: number;
  readonly altura: number;
  readonly rotulo: string;
  readonly texto: string;
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
};

type FaixaDeDiaInteiro = {
  readonly chave: string;
  readonly ocorrencia: OcorrenciaVisivel;
  readonly fundo: string;
  readonly borda: string;
  readonly coluna: number;
  readonly colunas: number;
  readonly trilha: number;
};

@Component({
  selector: 'nb-visao-de-horas',
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

  readonly selecionada = output<OcorrenciaVisivel>();
  /** O dia e a hora clicados no espaço vazio da grade. */
  readonly horaSelecionada = output<{ dia: string; hora: string }>();

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
    return primeiro ? horasDoDia(primeiro, this.fuso()) : [];
  });

  protected readonly colunas = computed<readonly Coluna[]>(() => {
    const cores = new Map(this.agendas().map((a) => [a.id, a.color]));
    const comHora = this.ocorrencias().filter((o) => !o.isAllDay);

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
          ...pinturaDe(cores.get(ocorrencia.calendarId)),
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

    inject(DestroyRef).onDestroy(() => clearInterval(relogio));
  }

  /** `AAAA-MM-DD` do dia, que é o que o formulário recebe. */
  protected comoTexto(dia: DataCivil): string {
    return comoTexto(dia);
  }

  private montarColuna(
    dia: DataCivil,
    comHora: readonly OcorrenciaVisivel[],
    cores: ReadonlyMap<string, string>,
  ): Coluna {
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

    const porChave = new Map(posicoes.map((p) => [p.id, p.ocorrencia]));
    const distribuidas = distribuirColunas(
      posicoes.map(({ id, topo, altura }) => ({ id, topo, altura })),
    );

    return {
      dia,
      rotuloCurto: rotuloCurtoDe(dia),
      numero: dia.dia,
      ehHoje: mesmoDia(dia, this.hoje()),
      horas: celulasDeHora(dia, horasDoDia(dia, this.fuso())),
      faixas: distribuidas.flatMap((c) => {
        const ocorrencia = porChave.get(c.id);
        if (!ocorrencia) {
          return [];
        }

        return [
          {
            chave: c.id,
            ocorrencia,
            ...pinturaDe(cores.get(ocorrencia.calendarId)),
            topo: c.topo * 100,
            altura: c.altura * 100,
            esquerda: (c.coluna / c.colunas) * 100,
            largura: (1 / c.colunas) * 100,
            horario: horarioDe(ocorrencia, this.fuso()),
          },
        ];
      }),
      agora: this.posicaoDeAgora(dia),
    };
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

function pinturaDe(cor: string | undefined): { fundo: string; borda: string } {
  const base = cor ?? 'var(--accent)';

  return {
    fundo: `color-mix(in oklab, ${base} 26%, transparent)`,
    borda: base,
  };
}

function horarioDe(ocorrencia: OcorrenciaVisivel, fuso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: fuso,
  }).format(new Date(ocorrencia.inicio));
}

/** "Qua" — formatado em UTC porque a entrada é data civil. Ver visao-de-mes.ts. */
function rotuloCurtoDe(dia: DataCivil): string {
  const texto = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(dia.ano, dia.mes - 1, dia.dia)));

  return texto.replace('.', '').replace(/^./, (l) => l.toUpperCase());
}

function mesmoDia(a: DataCivil, b: DataCivil): boolean {
  return a.ano === b.ano && a.mes === b.mes && a.dia === b.dia;
}

function comoTexto(dia: DataCivil): string {
  return `${dia.ano}-${dois(dia.mes)}-${dois(dia.dia)}`;
}

function dois(valor: number): string {
  return String(valor).padStart(2, '0');
}

/**
 * As horas de um dia como células clicáveis.
 *
 * Cada uma é um `button`: é o que dá acesso por teclado a criar um evento num
 * horário. A primeira versão usava um `div` com `(click)` e calculava a hora
 * pela posição vertical do cursor — mais preciso para o mouse, e **inalcançável**
 * para quem navega por teclado. O lint apontou, e estava certo.
 *
 * A altura de cada célula é a distância até a hora seguinte, e não 1/24: num dia
 * de 23 ou 25 horas as células precisam acompanhar as marcas, ou a grade mostra
 * uma linha num lugar e aceita o clique em outro.
 */
function celulasDeHora(
  dia: DataCivil,
  marcas: readonly MarcaDeHora[],
): readonly CelulaDeHora[] {
  return marcas.map((marca, i) => {
    const proxima = marcas[i + 1]?.posicao ?? 1;

    return {
      hora: marca.hora,
      topo: marca.posicao * 100,
      altura: (proxima - marca.posicao) * 100,
      texto: `${dois(marca.hora)}:00`,
      rotulo: `Criar evento às ${marca.hora}h de ${rotuloLongoDe(dia)}`,
    };
  });
}

/** "15 de junho", para o rótulo acessível do botão de hora. */
function rotuloLongoDe(dia: DataCivil): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(dia.ano, dia.mes - 1, dia.dia)));
}

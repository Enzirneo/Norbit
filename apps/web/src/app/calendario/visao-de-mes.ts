/**
 * A grade de mês.
 *
 * Componente de apresentação: recebe a grade, as ocorrências e o fuso, e
 * desenha. Nenhuma conta de calendário acontece aqui — ela vive em
 * `libs/domain/src/lib/calendario`, testada sem navegador.
 *
 * O que **é** decisão desta camada: quantas faixas cabem numa célula antes de
 * virar "+N", e com que cor cada barra é pintada.
 */
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import type { AgendaVisivel, OcorrenciaVisivel } from '@norbit/contracts';
import {
  faixasDaSemana,
  type CelulaDaGrade,
  type GradeDeMes,
} from '@norbit/domain';

/**
 * Quantas faixas uma célula mostra antes de resumir o resto em "+N".
 *
 * Sem teto, um dia cheio esticaria a linha inteira da grade e as outras semanas
 * encolheriam — a altura fixa de seis semanas (ver `grade-de-mes.ts`) só serve
 * se a altura de cada linha também for previsível.
 */
const FAIXAS_VISIVEIS = 3;

type BarraNaSemana = {
  readonly chave: string;
  readonly ocorrencia: OcorrenciaVisivel;
  /**
   * Cores já resolvidas em texto, e **não** uma custom property no template.
   *
   * O compilador do Angular 22 renomeia toda custom property declarada no
   * estilo do componente para `--%NS%x`, mas um `[style.--x]` vindo do template
   * escreve o nome cru. As duas pontas só se encontram porque a substituição de
   * `%NS%` está desligada por padrão — depender disso é depender de um padrão
   * que pode mudar. `color-mix` resolvido aqui não tem esse risco.
   */
  readonly fundo: string;
  readonly borda: string;
  readonly coluna: number;
  readonly colunas: number;
  readonly trilha: number;
  readonly horario: string | null;
};

type SemanaDesenhada = {
  readonly celulas: readonly CelulaDaGrade[];
  readonly barras: readonly BarraNaSemana[];
  /** Quantas faixas escondidas cobrem cada coluna, para o "+N". */
  readonly escondidas: readonly number[];
};

@Component({
  selector: 'nb-visao-de-mes',
  templateUrl: './visao-de-mes.html',
  styleUrl: './visao-de-mes.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VisaoDeMes {
  readonly grade = input.required<GradeDeMes>();
  readonly ocorrencias = input.required<readonly OcorrenciaVisivel[]>();
  readonly agendas = input.required<readonly AgendaVisivel[]>();
  /** O fuso de quem está vendo — é ele que decide em que dia cada hora cai. */
  readonly fuso = input.required<string>();
  /** O dia de hoje, em data civil e já no fuso de quem vê. */
  readonly hoje = input.required<{ ano: number; mes: number; dia: number }>();

  readonly selecionada = output<OcorrenciaVisivel>();

  protected readonly diasDaSemana = computed(() => nomesDosDias(this.grade()));

  protected readonly semanas = computed<readonly SemanaDesenhada[]>(() => {
    const cores = new Map(this.agendas().map((a) => [a.id, a.color]));
    const porChave = new Map(
      this.ocorrencias().map((o) => [chaveDa(o), o] as const),
    );

    return this.grade().semanas.map((celulas) =>
      this.desenhar(celulas, porChave, cores),
    );
  });

  protected ehHoje(celula: CelulaDaGrade): boolean {
    const hoje = this.hoje();
    return (
      celula.ano === hoje.ano &&
      celula.mes === hoje.mes &&
      celula.dia === hoje.dia
    );
  }

  private desenhar(
    celulas: readonly CelulaDaGrade[],
    porChave: ReadonlyMap<string, OcorrenciaVisivel>,
    cores: ReadonlyMap<string, string>,
  ): SemanaDesenhada {
    // A chave combina o id da linha com o início da ocorrência: numa série, o
    // `id` repete, e `empilharFaixas` recusa id duplicado de propósito.
    const { faixas } = faixasDaSemana(
      celulas,
      [...porChave].map(([chave, o]) => ({
        id: chave,
        inicio: new Date(o.inicio),
        fim: new Date(o.fim),
      })),
      this.fuso(),
    );

    const escondidas = celulas.map(() => 0);

    const barras = faixas.flatMap((faixa) => {
      const ocorrencia = porChave.get(faixa.id);
      if (!ocorrencia) {
        return [];
      }

      if (faixa.trilha >= FAIXAS_VISIVEIS) {
        for (let c = faixa.de; c <= faixa.ate; c++) {
          escondidas[c] = (escondidas[c] ?? 0) + 1;
        }
        return [];
      }

      return [
        {
          chave: faixa.id,
          ocorrencia,
          ...pinturaDe(cores.get(ocorrencia.calendarId)),
          // O CSS Grid conta colunas de 1, não de 0.
          coluna: faixa.de + 1,
          colunas: faixa.ate - faixa.de + 1,
          trilha: faixa.trilha,
          horario: horarioDe(ocorrencia, this.fuso()),
        },
      ];
    });

    return { celulas, barras, escondidas };
  }
}

/** A identidade de uma instância: a linha mais o início original. Ver docs/08. */
function chaveDa(ocorrencia: OcorrenciaVisivel): string {
  return `${ocorrencia.id}|${ocorrencia.inicioOriginal}`;
}

/**
 * A hora de início, ou `null` para quem ocupa o dia todo.
 *
 * Mostrar "00:00" num evento de dia inteiro seria ruído: a informação dele é o
 * título, não o horário.
 */
function horarioDe(ocorrencia: OcorrenciaVisivel, fuso: string): string | null {
  if (ocorrencia.isAllDay) {
    return null;
  }

  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: fuso,
  }).format(new Date(ocorrencia.inicio));
}

/**
 * A cor da agenda, virada em preenchimento e borda.
 *
 * `color-mix` em vez de uma tabela de variantes por cor: a cor da agenda é
 * escolhida pela pessoa e pode ser qualquer hexadecimal, então não existe
 * variante pré-computada para ela.
 */
function pinturaDe(cor: string | undefined): {
  fundo: string;
  borda: string;
} {
  const base = cor ?? 'var(--accent)';

  return {
    fundo: `color-mix(in oklab, ${base} 22%, transparent)`,
    borda: base,
  };
}

/**
 * Os nomes dos dias, na ordem da grade.
 *
 * Tirados da **primeira semana da própria grade**, e não de uma lista fixa: é o
 * que faz o cabeçalho acompanhar o início de semana escolhido sem uma segunda
 * fonte de verdade para rotacionar.
 *
 * Formatado em UTC de propósito: a entrada é data civil, virou meia-noite UTC,
 * e ler de volta em UTC devolve o mesmo dia. Usar o fuso de quem vê aqui faria
 * o nome deslizar um dia.
 */
function nomesDosDias(grade: GradeDeMes): readonly string[] {
  const formato = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short',
    timeZone: 'UTC',
  });

  return (grade.semanas[0] ?? []).map((celula) =>
    formato
      .format(new Date(Date.UTC(celula.ano, celula.mes - 1, celula.dia)))
      // `pt-BR` devolve "dom.", "seg." — a abreviação já é curta, o ponto é ruído.
      .replace('.', '')
      .replace(/^./, (letra) => letra.toUpperCase()),
  );
}

/**
 * De ocorrência para célula da grade.
 *
 * A ponte entre o que a API devolve (instantes) e o que a tela desenha
 * (colunas). Fica em `libs/domain` porque é aqui que nasce o defeito "o evento
 * aparece no dia errado": um instante cai em dias diferentes conforme o fuso, e
 * o fim de um intervalo é exclusivo.
 */
import { paraHoraLocal } from '../tempo/zona';
import { empilharFaixas, type Empilhamento } from './faixas';
import type { CelulaDaGrade } from './grade-de-mes';

export type OcorrenciaNaGrade = {
  readonly id: string;
  readonly inicio: Date;
  readonly fim: Date;
};

/**
 * As faixas de uma semana, já empilhadas em trilhas.
 *
 * O fuso é o de **quem está vendo**: a grade mostra o dia local de quem olha. O
 * fuso em que o evento foi criado é outra coisa, e serve para a recorrência.
 */
export function faixasDaSemana(
  semana: readonly CelulaDaGrade[],
  ocorrencias: readonly OcorrenciaNaGrade[],
  fuso: string,
): Empilhamento {
  const dias = semana.map(ordinalDe);
  const primeiro = dias[0];
  const ultimo = dias[dias.length - 1];

  if (primeiro === undefined || ultimo === undefined) {
    return { faixas: [], trilhas: 0 };
  }

  const itens = ocorrencias.flatMap((ocorrencia) => {
    exigirOrdem(ocorrencia);

    const inicio = ordinalLocal(ocorrencia.inicio, fuso);
    const fim = ordinalDoUltimoDia(ocorrencia, fuso);

    // A decisão de descartar é da ocorrência **inteira**, não de cada ponta: ela
    // fica de fora só quando termina antes da semana ou começa depois dela. Uma
    // primeira versão decidia ponta por ponta, e aí um evento inteiramente
    // anterior tinha as duas pontas presas à coluna 0 e aparecia no domingo.
    if (fim < primeiro || inicio > ultimo) {
      return [];
    }

    return [
      {
        id: ocorrencia.id,
        de: coluna(dias, inicio),
        ate: coluna(dias, fim),
      },
    ];
  });

  return empilharFaixas(itens);
}

/**
 * O último dia que a ocorrência **pinta**.
 *
 * O fim é exclusivo, então um dia inteiro de 15/06 termina na meia-noite que
 * **abre** o 16 — e não pode pintar a coluna do 16. Recuar um milissegundo é o
 * que resolve, e tratar duração zero à parte é o que impede o marco no tempo de
 * cair no dia anterior ou desaparecer.
 */
function ordinalDoUltimoDia(
  ocorrencia: OcorrenciaNaGrade,
  fuso: string,
): number {
  if (ocorrencia.fim.getTime() === ocorrencia.inicio.getTime()) {
    return ordinalLocal(ocorrencia.inicio, fuso);
  }

  return ordinalLocal(new Date(ocorrencia.fim.getTime() - 1), fuso);
}

/**
 * A coluna do dia, presa aos extremos da semana.
 *
 * Prender em vez de descartar é o que faz a viagem que começou na semana
 * passada aparecer **recortada** em vez de sumir. Chamada só depois da
 * verificação de sobreposição, então o `indexOf` sempre encontra: um dia civil
 * entre o primeiro e o último de uma semana é um dos sete.
 */
function coluna(dias: readonly number[], ordinal: number): number {
  const primeiro = dias[0] as number;
  const ultimo = dias[dias.length - 1] as number;

  if (ordinal <= primeiro) {
    return 0;
  }
  if (ordinal >= ultimo) {
    return dias.length - 1;
  }

  return dias.indexOf(ordinal);
}

/** Dias civis comparáveis como número, sem virar instante de novo. */
function ordinalDe(dia: { ano: number; mes: number; dia: number }): number {
  return dia.ano * 10_000 + dia.mes * 100 + dia.dia;
}

function ordinalLocal(instante: Date, fuso: string): number {
  return ordinalDe(paraHoraLocal(instante, fuso));
}

function exigirOrdem(ocorrencia: OcorrenciaNaGrade): void {
  if (ocorrencia.fim.getTime() < ocorrencia.inicio.getTime()) {
    throw new Error(
      `Ocorrência "${ocorrencia.id}" fora de ordem: o fim vem antes do início.`,
    );
  }
}

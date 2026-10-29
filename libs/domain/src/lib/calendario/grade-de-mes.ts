/**
 * A grade da visão de mês.
 *
 * Decide em que célula cada dia cai, e qual intervalo a API precisa devolver
 * para preencher aquela tela. Fica aqui, e não no componente, porque é
 * aritmética de calendário — e porque errar isto produz o defeito mais visível
 * de um produto de agenda: o evento na linha errada.
 *
 * Tudo em data civil. Instante só aparece em `intervaloDaGrade`, que é a
 * fronteira com a consulta.
 */
import { paraInstante } from '../tempo/zona';
import { somarDias, type DataCivil } from '../recorrencia/civil';

/**
 * Seis semanas, sempre.
 *
 * Altura fixa é uma decisão de interface tomada aqui porque muda o cálculo: com
 * quatro, cinco ou seis linhas conforme o mês, a grade muda de tamanho ao
 * navegar e tudo abaixo dela pula. O preço é uma linha de dias vizinhos a mais
 * em alguns meses — barato, e o fevereiro que caberia em quatro linhas é o
 * único caso em que isso é visível.
 */
export const SEMANAS_NA_GRADE = 6;

const DIAS_NA_SEMANA = 7;

export type CelulaDaGrade = DataCivil & {
  /** `false` para os dias do mês vizinho que completam a primeira e a última linha. */
  readonly noMes: boolean;
};

export type GradeDeMes = {
  readonly ano: number;
  readonly mes: number;
  readonly semanas: readonly (readonly CelulaDaGrade[])[];
  readonly primeiroDia: DataCivil;
  readonly ultimoDia: DataCivil;
};

export function gradeDeMes(entrada: {
  readonly ano: number;
  readonly mes: number;
  /** 0 = domingo … 6 = sábado, como `UserSettings.weekStartsOn`. */
  readonly inicioDaSemana: number;
}): GradeDeMes {
  exigirInicioDeSemana(entrada.inicioDaSemana);

  const primeiroDia = somarDias(
    { ano: entrada.ano, mes: entrada.mes, dia: 1 },
    -recuoAteOInicioDaSemana(entrada),
  );

  const total = SEMANAS_NA_GRADE * DIAS_NA_SEMANA;
  const celulas = Array.from({ length: total }, (_, i) =>
    comMarcaDeMes(somarDias(primeiroDia, i), entrada),
  );

  const semanas = Array.from({ length: SEMANAS_NA_GRADE }, (_, linha) =>
    celulas.slice(linha * DIAS_NA_SEMANA, (linha + 1) * DIAS_NA_SEMANA),
  );

  return {
    ano: entrada.ano,
    mes: entrada.mes,
    semanas,
    primeiroDia,
    ultimoDia: somarDias(primeiroDia, total - 1),
  };
}

/**
 * O intervalo que a API precisa cobrir para esta grade.
 *
 * Fim **exclusivo**, como todo intervalo do produto (ver `docs/09`): vai da
 * meia-noite do primeiro dia visível à meia-noite **depois** do último. É o que
 * faz um evento que termina na meia-noite do dia seguinte não vazar para a
 * grade do mês que vem.
 *
 * O fuso é o de **quem está vendo** — a grade é uma tela, e o que ela mostra é
 * o dia local de quem olha. O fuso do evento é outra coisa, e vive na linha dele.
 */
export function intervaloDaGrade(
  grade: GradeDeMes,
  fuso: string,
): { de: Date; ate: Date } {
  return {
    de: meiaNoite(grade.primeiroDia, fuso),
    ate: meiaNoite(somarDias(grade.ultimoDia, 1), fuso),
  };
}

function meiaNoite(dia: DataCivil, fuso: string): Date {
  return paraInstante({ ...dia, hora: 0, minuto: 0 }, fuso);
}

/**
 * Quantos dias recuar do dia 1º para chegar no começo da semana dele.
 *
 * O `+ 7` antes do módulo é o que impede o resultado negativo quando o início
 * da semana vem depois do dia da semana do dia 1º — sem ele, a grade começaria
 * **no futuro** e o mês apareceria cortado.
 */
function recuoAteOInicioDaSemana(entrada: {
  readonly ano: number;
  readonly mes: number;
  readonly inicioDaSemana: number;
}): number {
  const diaDaSemanaDoPrimeiro = new Date(
    Date.UTC(entrada.ano, entrada.mes - 1, 1),
  ).getUTCDay();

  return (
    (diaDaSemanaDoPrimeiro - entrada.inicioDaSemana + DIAS_NA_SEMANA) %
    DIAS_NA_SEMANA
  );
}

/**
 * Marca a célula como do mês exibido ou de um vizinho.
 *
 * A comparação de **ano** é redundante para uma grade de 42 dias: ela nunca
 * abrange o mesmo mês de dois anos diferentes, então nenhum teste a distingue —
 * verificado por mutação, e registrado aqui para que ninguém procure o teste que
 * não existe.
 *
 * Mantida porque a pergunta que esta função responde é "este dia pertence ao mês
 * exibido?", e responder isso só pelo número do mês é **falso em geral**. O dia
 * em que algo reaproveitar o cálculo com um intervalo maior, ela já está certa.
 */
function comMarcaDeMes(
  data: DataCivil,
  mesExibido: { readonly ano: number; readonly mes: number },
): CelulaDaGrade {
  return {
    ...data,
    noMes: data.ano === mesExibido.ano && data.mes === mesExibido.mes,
  };
}

/**
 * `weekStartsOn` vem do banco como inteiro.
 *
 * Um 7 ou um -1 ali só pode ser defeito, e desenhar a grade torta esconderia a
 * causa atrás de "os dias estão deslocados".
 */
function exigirInicioDeSemana(valor: number): void {
  if (!Number.isInteger(valor) || valor < 0 || valor > 6) {
    throw new Error(
      `Início de semana inválido: ${valor}. Use 0 (domingo) a 6 (sábado).`,
    );
  }
}

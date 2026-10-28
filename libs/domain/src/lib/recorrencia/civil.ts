/**
 * Aritmética de data civil — ano, mês e dia, sem hora e sem fuso.
 *
 * A expansão de recorrência raciocina em datas de calendário ("a segunda terça
 * de março"), e só no fim converte para instante. Misturar as duas coisas é a
 * origem do erro clássico de calendário: somar 86.400.000 ms para "amanhã", o
 * que falha exatamente no dia em que o fuso muda.
 *
 * Usa `Date.UTC` como motor para não reimplementar calendário gregoriano —
 * mas sempre em UTC, onde não existe horário de verão para interferir.
 */
import type { DiaDaSemana } from './rrule';

export type DataCivil = {
  readonly ano: number;
  /** 1 a 12. */
  readonly mes: number;
  readonly dia: number;
};

const DIAS_DA_SEMANA: readonly DiaDaSemana[] = [
  'SU',
  'MO',
  'TU',
  'WE',
  'TH',
  'FR',
  'SA',
];

const MS_POR_DIA = 86_400_000;

export function diasNoMes(ano: number, mes: number): number {
  // Dia 0 do mês seguinte é o último dia deste mês, e o `Date` cuida de ano
  // bissexto, inclusive da regra dos séculos.
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

export function diaDaSemanaDe(data: DataCivil): DiaDaSemana {
  const indice = new Date(
    Date.UTC(data.ano, data.mes - 1, data.dia),
  ).getUTCDay();

  // O índice vem de 0 a 6 e o array tem 7 posições, então o acesso é seguro.
  return DIAS_DA_SEMANA[indice] as DiaDaSemana;
}

export function somarDias(data: DataCivil, dias: number): DataCivil {
  const instante =
    Date.UTC(data.ano, data.mes - 1, data.dia) + dias * MS_POR_DIA;
  const d = new Date(instante);

  return {
    ano: d.getUTCFullYear(),
    mes: d.getUTCMonth() + 1,
    dia: d.getUTCDate(),
  };
}

/** Avança meses mantendo o ano coerente, sem tocar no dia. */
export function somarMeses(
  ano: number,
  mes: number,
  meses: number,
): { ano: number; mes: number } {
  const zeroABase = ano * 12 + (mes - 1) + meses;

  return {
    ano: Math.floor(zeroABase / 12),
    mes: (zeroABase % 12) + 1,
  };
}

/**
 * Resolve um `BYMONTHDAY` para o dia do mês, ou `null` se aquele mês não tem.
 *
 * `-1` é o último dia; `31` em fevereiro não existe e devolve `null`, porque a
 * RFC manda **ignorar** a data inválida. Aproximar para o dia 28 inventaria um
 * compromisso num dia que a pessoa não escolheu.
 */
export function resolverDiaDoMes(
  ano: number,
  mes: number,
  pedido: number,
): number | null {
  const total = diasNoMes(ano, mes);
  const dia = pedido > 0 ? pedido : total + pedido + 1;

  return dia >= 1 && dia <= total ? dia : null;
}

/**
 * Resolve uma ordem como `2TU` (segunda terça) ou `-1FR` (última sexta).
 *
 * Devolve `null` quando o mês não tem aquela ocorrência — um `5MO` só existe
 * em alguns meses.
 */
export function resolverDiaOrdenado(
  ano: number,
  mes: number,
  ordem: number,
  dia: DiaDaSemana,
): number | null {
  const total = diasNoMes(ano, mes);
  const candidatos: number[] = [];

  for (let d = 1; d <= total; d++) {
    if (diaDaSemanaDe({ ano, mes, dia: d }) === dia) {
      candidatos.push(d);
    }
  }

  const indice = ordem > 0 ? ordem - 1 : candidatos.length + ordem;
  return candidatos[indice] ?? null;
}

/**
 * Leitura do subconjunto de RRULE (RFC 5545) que o Norbit oferece.
 *
 * Não é um parser completo de propósito. A RFC tem partes que nenhuma
 * interface do produto expõe, e implementar o que não se oferece é código sem
 * teste de uso real.
 *
 * O princípio que guia o que falta: **recusar, nunca ignorar**. Uma regra com
 * `BYSETPOS` que o parser descartasse em silêncio geraria ocorrências
 * diferentes das que a pessoa pediu, e o sintoma seria "o evento aparece no dia
 * errado" — sem nada no log. Melhor falhar na gravação.
 */

export type Frequencia = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

export type DiaDaSemana = 'SU' | 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA';

/** "Segunda terça-feira do mês" (`2TU`), "última sexta" (`-1FR`). */
export type DiaOrdenado = {
  readonly ordem: number;
  readonly dia: DiaDaSemana;
};

export type Regra = {
  readonly freq: Frequencia;
  readonly intervalo: number;
  readonly porDiaDaSemana?: readonly DiaDaSemana[];
  readonly porDiaDaSemanaNoMes?: readonly DiaOrdenado[];
  /** Positivo conta do início do mês; negativo, do fim (`-1` é o último dia). */
  readonly porDiaDoMes?: readonly number[];
  readonly ocorrencias?: number;
  readonly ate?: Date;
};

const FREQUENCIAS: readonly string[] = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'];

const DIAS: readonly string[] = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

/** Partes da RFC que este parser reconhece mas não implementa. */
const NAO_IMPLEMENTADAS: readonly string[] = [
  'BYSETPOS',
  'BYWEEKNO',
  'BYYEARDAY',
  'BYHOUR',
  'BYMINUTE',
  'BYSECOND',
  'BYMONTH',
  'WKST',
];

const ACEITAS: readonly string[] = [
  'FREQ',
  'INTERVAL',
  'BYDAY',
  'BYMONTHDAY',
  'COUNT',
  'UNTIL',
];

const DIA_ORDENADO = /^([+-]?\d+)?([A-Z]{2})$/;

export function lerRrule(texto: string): Regra {
  const partes = separar(texto);

  const freq = lerFreq(partes.get('FREQ'));
  const porDia = lerByDay(partes.get('BYDAY'));

  const ocorrencias = lerContagem(partes.get('COUNT'));
  const ate = lerAte(partes.get('UNTIL'));

  if (ocorrencias !== undefined && ate !== undefined) {
    throw new Error('A regra não pode ter COUNT e UNTIL ao mesmo tempo.');
  }

  return limpar({
    freq,
    intervalo: lerIntervalo(partes.get('INTERVAL')),
    porDiaDaSemana: porDia.simples,
    porDiaDaSemanaNoMes: porDia.ordenados,
    porDiaDoMes: lerByMonthDay(partes.get('BYMONTHDAY')),
    ocorrencias,
    ate,
  });
}

function separar(texto: string): Map<string, string> {
  const limpo = texto.trim().replace(/^RRULE:/i, '');
  const partes = new Map<string, string>();

  for (const pedaco of limpo.split(';')) {
    if (pedaco.trim() === '') {
      continue;
    }

    const [chave, valor] = pedaco.split('=');
    const nome = (chave ?? '').trim().toUpperCase();

    if (NAO_IMPLEMENTADAS.includes(nome)) {
      throw new Error(
        `A parte ${nome} da RRULE não é suportada pelo Norbit. Use uma regra mais simples.`,
      );
    }

    if (!ACEITAS.includes(nome)) {
      throw new Error(`Parâmetro de RRULE desconhecido: ${nome}.`);
    }

    partes.set(nome, (valor ?? '').trim());
  }

  return partes;
}

function lerFreq(valor: string | undefined): Frequencia {
  if (!valor) {
    throw new Error('A regra precisa de FREQ.');
  }

  const normalizado = valor.toUpperCase();
  if (!FREQUENCIAS.includes(normalizado)) {
    throw new Error(`FREQ não suportada: ${normalizado}.`);
  }

  return normalizado as Frequencia;
}

function lerIntervalo(valor: string | undefined): number {
  if (valor === undefined) {
    return 1;
  }

  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero < 1) {
    throw new Error(`INTERVAL precisa ser um inteiro positivo: ${valor}.`);
  }

  return numero;
}

function lerByDay(valor: string | undefined): {
  simples?: DiaDaSemana[];
  ordenados?: DiaOrdenado[];
} {
  if (!valor) {
    return {};
  }

  const simples: DiaDaSemana[] = [];
  const ordenados: DiaOrdenado[] = [];

  for (const bruto of valor.split(',')) {
    const item = bruto.trim().toUpperCase();
    const encontrado = DIA_ORDENADO.exec(item);
    const dia = encontrado?.[2];

    if (!dia || !DIAS.includes(dia)) {
      throw new Error(`Dia da semana inválido em BYDAY: ${item}.`);
    }

    if (encontrado[1] === undefined) {
      simples.push(dia as DiaDaSemana);
    } else {
      ordenados.push({ ordem: Number(encontrado[1]), dia: dia as DiaDaSemana });
    }
  }

  return {
    simples: simples.length > 0 ? simples : undefined,
    ordenados: ordenados.length > 0 ? ordenados : undefined,
  };
}

function lerByMonthDay(valor: string | undefined): number[] | undefined {
  if (!valor) {
    return undefined;
  }

  return valor.split(',').map((bruto) => {
    const numero = Number(bruto.trim());
    const valido =
      Number.isInteger(numero) && numero !== 0 && numero >= -31 && numero <= 31;

    if (!valido) {
      throw new Error(`BYMONTHDAY inválido: ${bruto}.`);
    }

    return numero;
  });
}

function lerContagem(valor: string | undefined): number | undefined {
  if (valor === undefined) {
    return undefined;
  }

  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero < 1) {
    throw new Error(`COUNT precisa ser um inteiro positivo: ${valor}.`);
  }

  return numero;
}

/**
 * `UNTIL` em UTC, como a RFC manda para eventos com hora.
 *
 * A forma de data pura (`20261231`) é interpretada como o fim daquele dia em
 * UTC: tratá-la como meia-noite cortaria o dia inteiro que a pessoa quis
 * incluir.
 */
function lerAte(valor: string | undefined): Date | undefined {
  if (!valor) {
    return undefined;
  }

  const comHora = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/.exec(valor);
  if (comHora) {
    const [, a, m, d, h, min, s] = comHora.map(Number);
    return new Date(Date.UTC(a, m - 1, d, h, min, s));
  }

  const soData = /^(\d{4})(\d{2})(\d{2})$/.exec(valor);
  if (soData) {
    const [, a, m, d] = soData.map(Number);
    return new Date(Date.UTC(a, m - 1, d, 23, 59, 59, 999));
  }

  throw new Error(`UNTIL em formato inválido: ${valor}.`);
}

/** Remove as chaves indefinidas, para que `toEqual` nos testes seja legível. */
function limpar(regra: Regra): Regra {
  const entradas = Object.entries(regra).filter(
    ([, valor]) => valor !== undefined,
  );
  return Object.fromEntries(entradas) as unknown as Regra;
}

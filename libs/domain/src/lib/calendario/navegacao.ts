/**
 * Andar para frente e para trás entre períodos.
 *
 * A seta da barra de navegação anda **no tamanho da visão**: mês anda mês,
 * semana anda sete dias, dia anda um. Andar sempre em dias faria a seta do mês
 * parar em 30 de janeiro e depois em 2 de março.
 *
 * Fica aqui, e não no componente, porque é aritmética de calendário com um caso
 * que se erra calado: o dia 31 não existe em todo mês.
 */
import { somarDias, type DataCivil } from '../recorrencia/civil';

export type Periodo = 'MONTH' | 'WEEK' | 'DAY';

export function avancarPeriodo(
  referencia: DataCivil,
  periodo: Periodo,
  passo: number,
): DataCivil {
  if (!Number.isInteger(passo)) {
    throw new Error(`Passo de navegação inválido: ${passo}.`);
  }

  switch (periodo) {
    case 'DAY':
      return somarDias(referencia, passo);
    case 'WEEK':
      return somarDias(referencia, passo * 7);
    case 'MONTH':
      return avancarMes(referencia, passo);
  }
}

/**
 * Avança meses mantendo o dia **no dia 1º**.
 *
 * O dia 31 não existe em todo mês, e somar um mês a 31 de janeiro é uma pergunta
 * sem resposta boa: 28 de fevereiro perde informação, 3 de março muda de mês.
 *
 * Na visão de mês o dia da referência não é usado para nada — o que importa é o
 * par ano/mês —, então fixá-lo em 1º é a resposta que não inventa nada. Quem
 * precisa preservar o dia está navegando por semana ou por dia.
 */
function avancarMes(referencia: DataCivil, passo: number): DataCivil {
  const zeroABase = referencia.ano * 12 + (referencia.mes - 1) + passo;

  return {
    ano: Math.floor(zeroABase / 12),
    mes: (zeroABase % 12) + 1,
    dia: 1,
  };
}

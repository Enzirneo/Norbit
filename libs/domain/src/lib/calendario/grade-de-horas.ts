/**
 * A grade de horas das visões de semana e dia.
 *
 * Resolve duas coisas: onde ficam as marcas de hora, e onde fica a faixa de um
 * evento — as duas como **fração do dia**, entre 0 e 1. Quem desenha multiplica
 * pela altura que tiver.
 *
 * A armadilha que justifica o módulo: **um dia não tem sempre 24 horas**. Nos
 * dois dias de virada de horário de verão ele tem 23 ou 25, e a conta usual
 * — minutos desde a meia-noite dividido por 1440 — desloca tudo depois da
 * virada. Num dia de 23 horas, as 23:00 cairiam **fora** da grade.
 *
 * Aqui a referência é sempre o tempo decorrido entre a meia-noite local e a
 * meia-noite local seguinte, que é a duração real daquele dia.
 */
import { paraInstante } from '../tempo/zona';
import { somarDias, type DataCivil } from '../recorrencia/civil';

export type MarcaDeHora = {
  readonly hora: number;
  /** Fração do dia, de 0 a 1. */
  readonly posicao: number;
};

export type Posicao = {
  /** Fração do dia onde a faixa começa. */
  readonly topo: number;
  /** Fração do dia que ela ocupa. */
  readonly altura: number;
};

/**
 * Altura mínima de uma faixa, como fração do dia.
 *
 * Equivale a uns sete minutos. Uma faixa de altura zero é invisível, e um evento
 * de duração zero ("entrega do relatório") precisa aparecer — a mesma razão pela
 * qual ele é tratado à parte na visão de mês.
 */
const ALTURA_MINIMA = 1 / 200;

/**
 * Os sete dias da semana que contém a data, começando no dia escolhido.
 *
 * `inicioDaSemana` é 0 = domingo … 6 = sábado, como `UserSettings.weekStartsOn`.
 * O `+ 7` antes do módulo impede o recuo negativo quando o início da semana vem
 * depois do dia da data — sem ele a semana começaria no futuro.
 */
export function diasDaSemanaDe(
  data: DataCivil,
  inicioDaSemana: number,
): readonly DataCivil[] {
  if (
    !Number.isInteger(inicioDaSemana) ||
    inicioDaSemana < 0 ||
    inicioDaSemana > 6
  ) {
    throw new Error(
      `Início de semana inválido: ${inicioDaSemana}. Use 0 (domingo) a 6 (sábado).`,
    );
  }

  const diaDaSemana = new Date(
    Date.UTC(data.ano, data.mes - 1, data.dia),
  ).getUTCDay();
  const recuo = (diaDaSemana - inicioDaSemana + 7) % 7;
  const primeiro = somarDias(data, -recuo);

  return Array.from({ length: 7 }, (_, i) => somarDias(primeiro, i));
}

/**
 * O intervalo a consultar para uma lista de dias contíguos.
 *
 * Da meia-noite do primeiro à meia-noite **depois** do último, fim exclusivo
 * como todo intervalo do produto. Serve tanto para a semana (sete dias) quanto
 * para o dia (um).
 */
export function intervaloDosDias(
  dias: readonly DataCivil[],
  fuso: string,
): { de: Date; ate: Date } {
  const primeiro = dias[0];
  const ultimo = dias[dias.length - 1];

  if (primeiro === undefined || ultimo === undefined) {
    throw new Error('Intervalo pedido para uma lista de dias vazia.');
  }

  return {
    de: paraInstante({ ...primeiro, hora: 0, minuto: 0 }, fuso),
    ate: paraInstante({ ...somarDias(ultimo, 1), hora: 0, minuto: 0 }, fuso),
  };
}

export function horasDoDia(
  dia: DataCivil,
  fuso: string,
): readonly MarcaDeHora[] {
  const { inicio, duracao } = limitesDoDia(dia, fuso);
  const marcas: MarcaDeHora[] = [];

  for (let hora = 0; hora < 24; hora++) {
    const instante = paraInstante({ ...dia, hora, minuto: 0 }, fuso);
    const decorrido = instante.getTime() - inicio.getTime();

    // Duas situações em que a hora não ganha marca:
    //
    // - a hora **não existe** naquele dia (o relógio saltou): `paraInstante`
    //   empurra para frente, e o instante devolvido tem outra hora de parede.
    //   Uma marca ali seria uma linha apontando para nada.
    // - a hora acontece **duas vezes** (o relógio voltou): a política é a
    //   primeira passagem, e por isso a marca não se repete — duas linhas
    //   escritas "1h" seriam incompreensíveis.
    if (
      decorrido < 0 ||
      decorrido >= duracao ||
      horaDe(instante, fuso) !== hora
    ) {
      continue;
    }

    marcas.push({ hora, posicao: decorrido / duracao });
  }

  return marcas;
}

/**
 * A faixa de um evento dentro de um dia, ou `null` se ele não toca o dia.
 *
 * Recorta nas duas pontas: um evento que começou ontem entra em 0, e um que
 * segue para amanhã termina em 1. Sem o recorte, a faixa sairia da coluna.
 */
export function faixaNoDia(entrada: {
  readonly dia: DataCivil;
  readonly fuso: string;
  readonly inicio: Date;
  readonly fim: Date;
}): Posicao | null {
  const {
    inicio: abre,
    fim: fecha,
    duracao,
  } = limitesDoDia(entrada.dia, entrada.fuso);

  const comeca = entrada.inicio.getTime();
  const termina = entrada.fim.getTime();

  // Intervalo semiaberto, como em todo o produto: quem termina exatamente na
  // meia-noite que abre o dia pertence ao dia anterior. O marco de duração zero
  // é a exceção — ele é um ponto, e pertence ao dia que o contém.
  const ehPonto = termina === comeca;
  const forinha =
    comeca >= fecha.getTime() ||
    (ehPonto ? comeca < abre.getTime() : termina <= abre.getTime());

  if (forinha) {
    return null;
  }

  const recortadoInicio = Math.max(comeca, abre.getTime());
  const recortadoFim = Math.min(termina, fecha.getTime());

  const topo = (recortadoInicio - abre.getTime()) / duracao;
  const altura = Math.max(
    (recortadoFim - recortadoInicio) / duracao,
    ALTURA_MINIMA,
  );

  return { topo, altura };
}

/**
 * A meia-noite que abre o dia, a que o fecha, e a duração real entre as duas.
 *
 * A duração é 23, 24 ou 25 horas conforme o dia. É ela que serve de denominador
 * para tudo neste módulo.
 */
function limitesDoDia(
  dia: DataCivil,
  fuso: string,
): { inicio: Date; fim: Date; duracao: number } {
  const inicio = paraInstante({ ...dia, hora: 0, minuto: 0 }, fuso);
  const fim = paraInstante({ ...somarDias(dia, 1), hora: 0, minuto: 0 }, fuso);

  return { inicio, fim, duracao: fim.getTime() - inicio.getTime() };
}

/**
 * Formatadores de hora, por fuso.
 *
 * Pelo mesmo motivo do cache em `tempo/zona.ts`: construir um
 * `Intl.DateTimeFormat` é caro, e `horaDe` é chamado 24 vezes por dia e por
 * coluna — 168 numa semana, a cada renderização. A primeira versão construía um
 * formatador novo em cada chamada.
 */
const formatadoresDeHora = new Map<string, Intl.DateTimeFormat>();

function horaDe(instante: Date, fuso: string): number {
  let formatador = formatadoresDeHora.get(fuso);

  if (!formatador) {
    formatador = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      hour12: false,
      timeZone: fuso,
    });
    formatadoresDeHora.set(fuso, formatador);
  }

  // `en-US` com `hour12: false` devolve "24" para a meia-noite em alguns
  // runtimes; o módulo 24 normaliza isso.
  return Number(formatador.format(instante)) % 24;
}

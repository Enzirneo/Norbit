/**
 * Hora de parede ↔ instante, para um fuso IANA.
 *
 * Sem dependência de biblioteca de datas: o `Intl` do próprio runtime já
 * carrega a base de fusos (a IANA tzdata), e é ela que sabe quando cada país
 * mudou de regra. Reimplementar isso, ou fixar uma tabela de offsets, seria
 * garantir erro na próxima vez que algum governo alterar o calendário — o que
 * acontece todo ano em algum lugar.
 */

export type HoraLocal = {
  readonly ano: number;
  /** 1 a 12, como as pessoas escrevem, não 0 a 11 como o `Date`. */
  readonly mes: number;
  readonly dia: number;
  readonly hora: number;
  readonly minuto: number;
};

/** Um minuto em milissegundos. */
const MINUTO = 60_000;

const formatadores = new Map<string, Intl.DateTimeFormat>();

/**
 * Formatadores são caros de construir e a expansão de recorrência chama isto
 * milhares de vezes por consulta de intervalo. O cache é o que mantém a
 * expansão barata.
 */
function formatador(zona: string): Intl.DateTimeFormat {
  const existente = formatadores.get(zona);
  if (existente) {
    return existente;
  }

  let novo: Intl.DateTimeFormat;
  try {
    novo = new Intl.DateTimeFormat('en-US', {
      timeZone: zona,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    throw new Error(`Fuso horário desconhecido: "${zona}".`);
  }

  formatadores.set(zona, novo);
  return novo;
}

/** A hora de parede que o relógio daquele fuso mostra naquele instante. */
export function paraHoraLocal(instante: Date, zona: string): HoraLocal {
  const partes = formatador(zona).formatToParts(instante);
  const valor = (tipo: Intl.DateTimeFormatPartTypes): number => {
    const parte = partes.find((p) => p.type === tipo);
    return parte ? Number(parte.value) : 0;
  };

  return {
    ano: valor('year'),
    mes: valor('month'),
    dia: valor('day'),
    // `hour12: false` pode render "24" para a meia-noite em alguns runtimes.
    hora: valor('hour') % 24,
    minuto: valor('minute'),
  };
}

/**
 * O deslocamento do fuso, em minutos, naquele instante.
 *
 * Negativo a oeste de Greenwich: `-180` para São Paulo, `-300` para Nova York
 * no horário padrão.
 */
export function offsetEmMinutos(instante: Date, zona: string): number {
  const local = paraHoraLocal(instante, zona);
  const comoSeFosseUtc = Date.UTC(
    local.ano,
    local.mes - 1,
    local.dia,
    local.hora,
    local.minuto,
    // Os segundos entram para o offset sair exato em fusos históricos que
    // tinham deslocamento com fração de minuto.
    segundosDe(instante, zona),
  );

  const diferenca = comoSeFosseUtc - zeraMilissegundos(instante.getTime());
  return Math.round(diferenca / MINUTO);
}

/** Um dia em milissegundos, para amostrar os dois lados de uma virada. */
const DIA = 86_400_000;

/**
 * O instante em que aquele relógio mostra aquela hora.
 *
 * Não dá para calcular direto: para saber o deslocamento preciso-se do
 * instante, e para achar o instante preciso-se do deslocamento. A saída é
 * **amostrar os dois lados** — o deslocamento um dia antes e um dia depois — e
 * gerar um candidato com cada um. Fora de uma virada os dois coincidem; dentro
 * de uma, os dois casos difíceis se distinguem pelo que os candidatos leem de
 * volta:
 *
 * | Candidatos válidos | Situação | Política |
 * | --- | --- | --- |
 * | os dois | a hora acontece duas vezes | o **primeiro**, porque quem marcou "01:30" quis dizer "assim que der 01:30" |
 * | um só | hora normal | ele |
 * | nenhum | a hora **não existe** | empurra para frente, mantendo a distância: 02:30 num dia que salta de 02:00 para 03:00 vira 03:30 |
 *
 * Recusar a hora inexistente faria um evento semanal àquele horário
 * desaparecer uma vez por ano, sem explicação para quem o criou.
 *
 * Uma primeira versão deste código fazia duas passadas com palpite, e no caso
 * da hora inexistente empurrava para **trás** — 02:30 virava 01:30. Foi o
 * teste que apontou; olhando o código, o comentário afirmava o contrário do que
 * ele fazia.
 */
export function paraInstante(local: HoraLocal, zona: string): Date {
  const comoUtc = Date.UTC(
    local.ano,
    local.mes - 1,
    local.dia,
    local.hora,
    local.minuto,
  );

  const offsetAntes = offsetEmMinutos(new Date(comoUtc - DIA), zona);
  const offsetDepois = offsetEmMinutos(new Date(comoUtc + DIA), zona);

  const comOffsetAntes = new Date(comoUtc - offsetAntes * MINUTO);
  const comOffsetDepois = new Date(comoUtc - offsetDepois * MINUTO);

  const antesServe = mesmaHora(paraHoraLocal(comOffsetAntes, zona), local);
  const depoisServe = mesmaHora(paraHoraLocal(comOffsetDepois, zona), local);

  if (antesServe && depoisServe) {
    // Ambígua: o menor instante é a primeira passagem.
    return comOffsetAntes <= comOffsetDepois ? comOffsetAntes : comOffsetDepois;
  }

  if (depoisServe) {
    return comOffsetDepois;
  }

  // `antesServe`, ou nenhum dos dois. No caso de nenhum — a hora engolida pela
  // virada — usar o deslocamento de antes é precisamente o empurrão para
  // frente: com um salto de uma hora, 02:30 cai em 03:30.
  return comOffsetAntes;
}

function mesmaHora(a: HoraLocal, b: HoraLocal): boolean {
  return (
    a.ano === b.ano &&
    a.mes === b.mes &&
    a.dia === b.dia &&
    a.hora === b.hora &&
    a.minuto === b.minuto
  );
}

function segundosDe(instante: Date, zona: string): number {
  const partes = formatador(zona).formatToParts(instante);
  const segundo = partes.find((p) => p.type === 'second');
  return segundo ? Number(segundo.value) : 0;
}

function zeraMilissegundos(ms: number): number {
  return ms - (((ms % 1000) + 1000) % 1000);
}

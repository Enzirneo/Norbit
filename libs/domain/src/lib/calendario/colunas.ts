/**
 * Eventos simultâneos, lado a lado.
 *
 * Duas reuniões das 9h às 10h não podem ser desenhadas uma sobre a outra. Esta
 * função decide em que coluna cada uma entra, e em quantas colunas a vizinhança
 * dela se divide.
 *
 * Opera sobre a **geometria** — topo e altura, já calculados por
 * `grade-de-horas` —, e não sobre instantes. É a geometria que não pode se
 * sobrepor na tela, e é nela que a altura mínima de um marco de duração zero já
 * está aplicada; refazer a conta a partir dos instantes abriria espaço para as
 * duas discordarem.
 */

export type ItemParaColuna = {
  readonly id: string;
  readonly topo: number;
  readonly altura: number;
};

export type NaColuna = ItemParaColuna & {
  readonly coluna: number;
  /** Em quantas colunas a **vizinhança** deste item se divide. */
  readonly colunas: number;
};

export function distribuirColunas(
  itens: readonly ItemParaColuna[],
): readonly NaColuna[] {
  for (const item of itens) {
    exigirGeometriaValida(item);
  }
  exigirIdsUnicos(itens);

  return vizinhancas(ordenar(itens)).flatMap(distribuirNaVizinhança);
}

/**
 * De cima para baixo, desempatando pelo `id`.
 *
 * O desempate é o que torna o resultado estável: sem ele, dois eventos no mesmo
 * horário trocariam de coluna conforme a ordem em que a API os devolvesse, e as
 * faixas pulariam de lado a cada renderização.
 */
function ordenar(itens: readonly ItemParaColuna[]): ItemParaColuna[] {
  return itens
    .slice()
    .sort((a, b) => a.topo - b.topo || a.id.localeCompare(b.id));
}

/**
 * Agrupa em vizinhanças de sobreposição **transitiva**.
 *
 * A contagem de colunas é por vizinhança, e não do dia inteiro: contar o dia
 * faria o evento solitário da tarde aparecer com um terço da largura porque a
 * manhã estava cheia.
 */
function vizinhancas(ordenados: readonly ItemParaColuna[]): ItemParaColuna[][] {
  const grupos: ItemParaColuna[][] = [];
  let atual: ItemParaColuna[] = [];
  let fimDoGrupo = Number.NEGATIVE_INFINITY;

  for (const item of ordenados) {
    // `>=` e não `>`: terminar exatamente onde o outro começa não é
    // sobreposição. Uma reunião das 9h às 10h e outra das 10h às 11h são
    // sequenciais, e dividir a largura entre elas seria desperdício.
    if (atual.length > 0 && item.topo >= fimDoGrupo) {
      grupos.push(atual);
      atual = [];
      fimDoGrupo = Number.NEGATIVE_INFINITY;
    }

    atual.push(item);
    fimDoGrupo = Math.max(fimDoGrupo, item.topo + item.altura);
  }

  if (atual.length > 0) {
    grupos.push(atual);
  }

  return grupos;
}

/**
 * Primeira coluna livre, dentro da vizinhança.
 *
 * Reaproveitar a coluna de quem já terminou é o que faz `A cruza B, B cruza C,
 * A não cruza C` caber em **duas** colunas em vez de três — com três, um terço
 * da largura ficaria vazio o tempo todo.
 */
function distribuirNaVizinhança(grupo: readonly ItemParaColuna[]): NaColuna[] {
  /** Até onde cada coluna está ocupada. */
  const ocupadaAte: number[] = [];
  const comColuna: (ItemParaColuna & { coluna: number })[] = [];

  for (const item of grupo) {
    const livre = ocupadaAte.findIndex((fim) => fim <= item.topo);
    const coluna = livre === -1 ? ocupadaAte.length : livre;

    ocupadaAte[coluna] = item.topo + item.altura;
    comColuna.push({ ...item, coluna });
  }

  const colunas = ocupadaAte.length;
  return comColuna.map((item) => ({ ...item, colunas }));
}

function exigirGeometriaValida(item: ItemParaColuna): void {
  if (!Number.isFinite(item.topo) || !Number.isFinite(item.altura)) {
    throw new Error(
      `Posição não finita em "${item.id}": ${item.topo}..${item.altura}.`,
    );
  }

  if (item.altura <= 0) {
    throw new Error(
      `Altura não positiva em "${item.id}": ${item.altura}. Uma faixa sem altura é invisível — veja a altura mínima em grade-de-horas.ts.`,
    );
  }
}

/**
 * Pelo mesmo motivo de `faixas.ts`: `OcorrenciaVisivel.id` é o id da **linha** e
 * repete entre as ocorrências de uma série. A identidade de uma instância é o
 * par com `inicioOriginal` (ver `docs/08`).
 */
function exigirIdsUnicos(itens: readonly ItemParaColuna[]): void {
  const vistos = new Set<string>();

  for (const { id } of itens) {
    if (vistos.has(id)) {
      throw new Error(
        `Item com id repetido: "${id}". Numa série recorrente, combine o id da linha com o início da ocorrência.`,
      );
    }
    vistos.add(id);
  }
}

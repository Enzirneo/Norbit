/**
 * Empilhamento das faixas de uma semana da grade.
 *
 * Um evento de vários dias é **uma** barra atravessando as células, não um chip
 * repetido em cada dia — repetir faria "Viagem" aparecer sete vezes. Duas barras
 * que compartilham um dia precisam de alturas diferentes, e é essa atribuição
 * que acontece aqui.
 *
 * Função pura, e não cálculo no componente, por dois motivos: é onde se erra por
 * um (barras sobrepostas na tela, ou um buraco entre duas que podiam dividir a
 * linha), e o resultado precisa ser **estável** — a ordem da resposta da API não
 * é garantida, e barras que pulam de altura a cada renderização são pior que
 * barras mal empilhadas.
 */

export type ItemParaEmpilhar = {
  readonly id: string;
  /** Primeira coluna ocupada, inclusiva. */
  readonly de: number;
  /** Última coluna ocupada, **inclusiva**. */
  readonly ate: number;
};

export type Faixa = ItemParaEmpilhar & { readonly trilha: number };

export type Empilhamento = {
  readonly faixas: readonly Faixa[];
  /** Quantas trilhas foram usadas — é a altura que a célula precisa ter. */
  readonly trilhas: number;
};

export function empilharFaixas(
  itens: readonly ItemParaEmpilhar[],
): Empilhamento {
  for (const item of itens) {
    exigirColunasValidas(item);
  }

  exigirIdsUnicos(itens);

  const faixas: Faixa[] = [];
  /** A última coluna ocupada em cada trilha, ou `-1` para trilha vazia. */
  const ocupadoAte: number[] = [];

  for (const item of ordenar(itens)) {
    const trilha = primeiraTrilhaLivre(ocupadoAte, item.de);
    ocupadoAte[trilha] = item.ate;
    faixas.push({ ...item, trilha });
  }

  return { faixas, trilhas: ocupadoAte.length };
}

/**
 * Da esquerda para a direita, **o mais longo primeiro**.
 *
 * A barra longa é a que se lê de ponta a ponta, e na trilha de cima ela fica
 * inteira. Se fosse para baixo, as curtas a quebrariam visualmente em pedaços.
 *
 * O desempate final pelo `id` é o que torna o resultado estável: sem ele, dois
 * eventos no mesmo dia e com o mesmo tamanho trocariam de altura conforme a
 * ordem em que a API os devolvesse.
 */
function ordenar(itens: readonly ItemParaEmpilhar[]): ItemParaEmpilhar[] {
  return itens
    .slice()
    .sort(
      (a, b) =>
        a.de - b.de ||
        b.ate - b.de - (a.ate - a.de) ||
        a.id.localeCompare(b.id),
    );
}

/**
 * A trilha mais baixa que já terminou antes desta coluna.
 *
 * `ocupadoAte[t] < de` e não `<=`: `ate` é inclusivo, então uma barra que
 * termina na coluna 2 ainda **ocupa** a 2, e outra começando na 2 conflita. Com
 * `<=`, as duas dividiriam a trilha e uma cobriria a outra.
 */
function primeiraTrilhaLivre(
  ocupadoAte: readonly number[],
  de: number,
): number {
  const livre = ocupadoAte.findIndex((fim) => fim < de);
  return livre === -1 ? ocupadoAte.length : livre;
}

function exigirColunasValidas(item: ItemParaEmpilhar): void {
  if (
    !Number.isInteger(item.de) ||
    !Number.isInteger(item.ate) ||
    item.de < 0 ||
    item.ate < 0
  ) {
    throw new Error(
      `Coluna inválida em "${item.id}": ${item.de}..${item.ate}. Use inteiros não negativos.`,
    );
  }

  if (item.de > item.ate) {
    throw new Error(
      `Faixa fora de ordem em "${item.id}": ${item.de} não vem antes de ${item.ate}.`,
    );
  }
}

/**
 * Dois itens com o mesmo `id` são defeito de quem chamou.
 *
 * O caso concreto: `OcorrenciaVisivel.id` é o id da **linha**, e ele repete
 * entre as ocorrências de uma série — a identidade de uma instância é o par
 * `id` + `inicioOriginal` (ver `docs/08`). Montar as faixas só pelo `id` faria
 * duas terças da mesma série virarem uma, e o desempate por `id` não teria como
 * distingui-las.
 *
 * O sintoma seria "o evento semanal só aparece uma vez na semana" — difícil de
 * atribuir à causa. Falhar alto é muito mais barato.
 */
function exigirIdsUnicos(itens: readonly ItemParaEmpilhar[]): void {
  const vistos = new Set<string>();

  for (const { id } of itens) {
    if (vistos.has(id)) {
      throw new Error(
        `Faixa com id repetido: "${id}". Cada faixa precisa de um identificador próprio — numa série recorrente, combine o id da linha com o início da ocorrência.`,
      );
    }
    vistos.add(id);
  }
}

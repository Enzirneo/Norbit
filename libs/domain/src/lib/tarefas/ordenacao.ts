/**
 * Ordenação manual de tarefas, com posição fracionária.
 *
 * `Task.position` é `Float` para que arrastar um item para o meio da lista seja
 * **uma** escrita, e não uma reindexação de tudo. A conta é simples — a posição
 * nova é a média das duas vizinhas — e o que exige cuidado é o fim do espaço:
 * dividir o intervalo pela metade repetidamente esgota o double.
 *
 * O modo de falha, se ninguém verificar, é silencioso: a média cai em cima de um
 * dos vizinhos, dois itens passam a ter a mesma posição, e a lista muda de ordem
 * sozinha a cada recarga — porque o critério de desempate é o que o Postgres
 * resolver devolver naquele dia.
 *
 * Por isso a função não devolve um número: devolve uma **decisão**. Ou tem
 * espaço, ou quem chama precisa renumerar.
 */

/**
 * O espaçamento usado em listas novas e em renumerações.
 *
 * 1024 dá cerca de dez inserções na mesma fenda antes de começar a usar casas
 * decimais, e umas sessenta antes de o double acabar. Mais que isso não compra
 * nada: renumerar uma lista é uma escrita em lote barata, e o caso que importa
 * é o normal, não o patológico.
 */
export const PASSO = 1024;

export type Reordenacao =
  | { readonly tipo: 'posicao'; readonly valor: number }
  | { readonly tipo: 'renumerar' };

/**
 * A posição para um item colocado entre dois vizinhos.
 *
 * `null` em qualquer lado significa borda da lista: `posicaoEntre(null, null)` é
 * a primeira tarefa.
 */
export function posicaoEntre(
  anterior: number | null,
  proxima: number | null,
): Reordenacao {
  exigirFinito(anterior);
  exigirFinito(proxima);

  if (anterior !== null && proxima !== null && anterior >= proxima) {
    throw new Error(
      `Vizinhos fora de ordem: ${anterior} não vem antes de ${proxima}.`,
    );
  }

  if (anterior === null && proxima === null) {
    // Começa em `PASSO`, e não em zero, para que sobre espaço **antes** do
    // primeiro item — arrastar algo para o topo depois não exige renumerar.
    return { tipo: 'posicao', valor: PASSO };
  }

  if (proxima === null) {
    return { tipo: 'posicao', valor: (anterior as number) + PASSO };
  }

  if (anterior === null) {
    // Recua um passo em vez de dividir por dois: a posição pode ser negativa,
    // e `proxima / 2` andaria no sentido **errado** para valores negativos.
    return { tipo: 'posicao', valor: proxima - PASSO };
  }

  return entre(anterior, proxima);
}

/** As posições de uma lista renumerada de `quantidade` itens, na ordem dada. */
export function renumerar(quantidade: number): number[] {
  if (!Number.isInteger(quantidade) || quantidade < 0) {
    throw new Error(`Quantidade inválida para renumerar: ${quantidade}.`);
  }

  return Array.from({ length: quantidade }, (_, i) => (i + 1) * PASSO);
}

/**
 * A média, se ela couber entre os dois.
 *
 * A comparação com as duas pontas é a verificação de verdade: quando os
 * vizinhos são doubles adjacentes, a média **arredonda** para um deles, e é
 * exatamente aí que a lista se corromperia.
 */
function entre(anterior: number, proxima: number): Reordenacao {
  const meio = anterior + (proxima - anterior) / 2;

  if (meio <= anterior || meio >= proxima) {
    return { tipo: 'renumerar' };
  }

  return { tipo: 'posicao', valor: meio };
}

/**
 * A posição vem do banco, e `NaN` ou `Infinity` ali só pode ser defeito.
 *
 * Deixar passar transformaria toda comparação seguinte em `false` — e a lista
 * ficaria fora de ordem sem nenhum erro em lugar nenhum.
 */
function exigirFinito(valor: number | null): void {
  if (valor !== null && !Number.isFinite(valor)) {
    throw new Error(`Posição não finita: ${valor}.`);
  }
}

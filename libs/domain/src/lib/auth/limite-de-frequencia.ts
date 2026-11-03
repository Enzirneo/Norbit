/**
 * Limite de frequência por janela deslizante.
 *
 * Guarda o instante de cada tentativa e conta quantas caíram nos últimos
 * `janelaMs`. Janela deslizante e não janela fixa: com a fixa, quem tenta
 * `maximo` vezes no fim de uma janela e `maximo` no começo da seguinte passa
 * com o dobro do permitido em poucos segundos.
 *
 * Função pura: o instante entra por parâmetro e o armazenamento é de quem
 * chama, então a regra se exercita inteira sem relógio e sem infraestrutura.
 */

export type RegraDeLimite = {
  /** Quantas tentativas cabem na janela. */
  readonly maximo: number;
  readonly janelaMs: number;
};

export type VereditoDeLimite =
  | { readonly permitido: true; readonly registros: readonly number[] }
  | { readonly permitido: false; readonly tentarDeNovoEmMs: number };

/**
 * @param registros instantes (ms) das tentativas anteriores, em ordem crescente
 * @param agora instante (ms) da tentativa que se quer avaliar
 *
 * A tentativa bloqueada **não** entra nos registros: se entrasse, quem insiste
 * estenderia o próprio bloqueio sem limite, e o limite viraria punição.
 */
export function avaliarLimite(
  registros: readonly number[],
  agora: number,
  regra: RegraDeLimite,
): VereditoDeLimite {
  if (!Number.isInteger(regra.maximo) || regra.maximo < 1) {
    throw new Error(`Máximo inválido: ${regra.maximo}. Use um inteiro >= 1.`);
  }
  if (!(regra.janelaMs > 0)) {
    throw new Error(`Janela inválida: ${regra.janelaMs}. Use um valor > 0.`);
  }

  // Estritamente dentro da janela: quem completa exatamente `janelaMs` já saiu.
  const vivos = registros.filter((t) => agora - t < regra.janelaMs);

  if (vivos.length < regra.maximo) {
    return { permitido: true, registros: [...vivos, agora] };
  }

  // A vaga abre quando o registro que ocupa a posição `maximo` a partir do fim
  // sair da janela.
  const decisivo = vivos[vivos.length - regra.maximo] ?? agora;
  return {
    permitido: false,
    tentarDeNovoEmMs: decisivo + regra.janelaMs - agora,
  };
}

/** Hexadecimal de cor: a forma em que ela se compara e se guarda. */

export const HEXADECIMAL = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Minúsculas e sempre seis dígitos, a forma que se compara e guarda. */
export function normalizarHex(cor: string): string {
  if (!HEXADECIMAL.test(cor)) {
    throw new Error(`"${cor}" não é uma cor hexadecimal (#rgb ou #rrggbb).`);
  }

  const minuscula = cor.toLowerCase();
  if (minuscula.length === 7) {
    return minuscula;
  }

  return `#${[1, 2, 3].map((i) => minuscula[i]?.repeat(2)).join('')}`;
}

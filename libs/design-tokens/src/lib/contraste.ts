/**
 * Cálculo de contraste, pela fórmula da WCAG 2.1.
 *
 * Existe porque "parece legível" não é critério. O par `dust-300` sobre
 * `space-800` foi usado por reflexo nas primeiras telas de autenticação, dá
 * 4.28:1 e reprova no AA — e ninguém percebeu olhando, porque num monitor bom,
 * para quem tem visão boa, ele parece perfeitamente confortável.
 *
 * Com esta função, o teste dos presets reprova a build em vez de deixar a
 * descoberta para a auditoria da Fase 7, com a interface toda construída em
 * cima. Ver docs/04-design-system.md.
 */

const HEXADECIMAL = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Razão mínima da WCAG AA para texto normal. */
export const MINIMO_TEXTO = 4.5;

/** Razão mínima da WCAG AA para texto grande e elementos gráficos. */
export const MINIMO_GRAFICO = 3;

/**
 * Luminância relativa, de 0 (preto) a 1 (branco).
 *
 * Não é o brilho ingênuo: cada canal passa por uma correção de gama antes de
 * ser ponderado, e o verde pesa dez vezes mais que o azul porque é assim que o
 * olho humano responde.
 */
export function luminancia(cor: string): number {
  const [r, g, b] = canais(cor);
  return 0.2126 * aLinear(r) + 0.7152 * aLinear(g) + 0.0722 * aLinear(b);
}

/** Razão de contraste entre duas cores, de 1 (iguais) a 21 (preto e branco). */
export function contraste(a: string, b: string): number {
  const la = luminancia(a);
  const lb = luminancia(b);

  const claro = Math.max(la, lb);
  const escuro = Math.min(la, lb);

  return (claro + 0.05) / (escuro + 0.05);
}

function canais(cor: string): [number, number, number] {
  if (!HEXADECIMAL.test(cor)) {
    throw new Error(`"${cor}" não é uma cor hexadecimal (#rgb ou #rrggbb).`);
  }

  const hex = cor.slice(1);
  const completo =
    hex.length === 3
      ? hex
          .split('')
          .map((c) => c + c)
          .join('')
      : hex;

  return [
    Number.parseInt(completo.slice(0, 2), 16),
    Number.parseInt(completo.slice(2, 4), 16),
    Number.parseInt(completo.slice(4, 6), 16),
  ];
}

/** Desfaz a correção de gama do sRGB. */
function aLinear(canal: number): number {
  const normalizado = canal / 255;

  return normalizado <= 0.03928
    ? normalizado / 12.92
    : Math.pow((normalizado + 0.055) / 1.055, 2.4);
}

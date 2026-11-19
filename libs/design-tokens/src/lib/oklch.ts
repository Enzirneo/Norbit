/**
 * OKLCH: claridade, croma e matiz como o olho os percebe.
 *
 * Existe porque derivar um tema a partir de duas cores exige "um pouco mais
 * claro" e "mais fraco, mas do mesmo matiz" — e em sRGB isso muda o matiz ao
 * longo do caminho, e a mesma variação de canal é enorme num tom e invisível em
 * outro. A conversão é a de Björn Ottosson (https://bottosson.github.io/posts/oklab/).
 *
 * Funções puras, sem DOM: rodam igual na web, na API e no iPhone.
 */
import { normalizarHex } from './hex';

export type Oklch = {
  readonly l: number;
  readonly c: number;
  readonly h: number;
};

type Rgb = readonly [number, number, number];

/** Abaixo disto a cor é considerada sem croma, e o matiz não significa nada. */
const CROMA_NEUTRO = 1e-4;

/** Folga numérica para dizer que um canal ainda está dentro da gama. */
const FOLGA = 1e-6;

export function hexParaOklch(hex: string): Oklch {
  const completo = normalizarHex(hex);
  const [r, g, b] = [1, 3, 5].map((i) =>
    aLinear(Number.parseInt(completo.slice(i, i + 2), 16) / 255),
  );

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  const claridade = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;

  const croma = Math.hypot(a, bb);
  const matiz = croma < CROMA_NEUTRO ? 0 : graus(Math.atan2(bb, a));

  return { l: claridade, c: croma < CROMA_NEUTRO ? 0 : croma, h: matiz };
}

/**
 * De OKLCH para hexadecimal. Se a cor não existe em sRGB, **perde croma** até
 * existir — mantém a claridade e o matiz, que são o que o contraste e a
 * identidade da cor dependem.
 */
export function oklchParaHex(cor: Oklch): string {
  const l = Math.min(1, Math.max(0, cor.l));
  const rgb = dentroDaGama(l, cor.c, cor.h);

  return `#${rgb
    .map((canal) =>
      Math.round(aSrgb(Math.min(1, Math.max(0, canal))) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

/** O maior croma, de 0 até `c`, que cabe em sRGB, por bisseção. */
function dentroDaGama(l: number, c: number, h: number): Rgb {
  const direto = paraLinear(l, c, h);
  if (cabe(direto)) {
    return direto;
  }

  let baixo = 0;
  let alto = c;
  for (let i = 0; i < 24; i++) {
    const meio = (baixo + alto) / 2;
    if (cabe(paraLinear(l, meio, h))) {
      baixo = meio;
    } else {
      alto = meio;
    }
  }

  return paraLinear(l, baixo, h);
}

function cabe(rgb: Rgb): boolean {
  return rgb.every((canal) => canal >= -FOLGA && canal <= 1 + FOLGA);
}

function paraLinear(l: number, c: number, h: number): Rgb {
  const radianos = (h * Math.PI) / 180;
  const a = c * Math.cos(radianos);
  const b = c * Math.sin(radianos);

  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;

  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
}

function graus(radianos: number): number {
  const g = (radianos * 180) / Math.PI;
  return g < 0 ? g + 360 : g;
}

function aLinear(canal: number): number {
  return canal <= 0.04045 ? canal / 12.92 : ((canal + 0.055) / 1.055) ** 2.4;
}

function aSrgb(canal: number): number {
  return canal <= 0.0031308
    ? canal * 12.92
    : 1.055 * canal ** (1 / 2.4) - 0.055;
}

/**
 * A cor de um avatar: o fundo que a pessoa escolheu e o texto que se lê sobre ele.
 *
 * A cor de perfil é livre, e nem toda cor aguenta texto em cima: nos tons médios
 * nem o quase preto nem o quase branco chegam a 4.5:1. Em vez de recusar a
 * escolha, ajusta-se a claridade (em OKLCH, mantendo o matiz) até o texto passar,
 * como o motor de temas faz com o destaque. Uma cor que já serve não é tocada.
 */
import { MINIMO_TEXTO, contraste } from './contraste';
import { hexParaOklch, oklchParaHex } from './oklch';
import { normalizarHex } from './hex';

export type CorDeAvatar = { readonly fundo: string; readonly texto: string };

/** Claridades da frente escura e da clara (como `melhorFrente` do motor). */
const FRENTE_ESCURA = 0.12;
const FRENTE_CLARA = 0.985;
const PASSO = 0.01;

export function corDeAvatar(cor: string): CorDeAvatar {
  const original = normalizarHex(cor);
  const { l, c, h } = hexParaOklch(original);
  const escura = oklchParaHex({ l: FRENTE_ESCURA, c: Math.min(c, 0.02), h });
  const clara = oklchParaHex({ l: FRENTE_CLARA, c: Math.min(c, 0.02), h });

  const usarEscura = contraste(escura, original) >= contraste(clara, original);
  const texto = usarEscura ? escura : clara;

  if (contraste(texto, original) >= MINIMO_TEXTO) {
    return { fundo: original, texto };
  }

  // Afasta o fundo da frente escolhida: mais claro para texto escuro, e o
  // inverso. Termina: nos extremos o contraste é o máximo possível.
  const sentido = usarEscura ? 1 : -1;
  for (let i = 1; i <= 100; i++) {
    const fundo = oklchParaHex({ l: l + sentido * PASSO * i, c, h });
    if (contraste(texto, fundo) >= MINIMO_TEXTO) {
      return { fundo, texto };
    }
  }

  return { fundo: usarEscura ? '#ffffff' : '#000000', texto };
}

/**
 * As sementes de um tema: tudo o que a pessoa escolhe de cor.
 *
 * Duas cores e um nível de contraste. O resto (superfícies, texto, bordas,
 * estados) é derivado, e por isso nunca fica incoerente: não há como combinar
 * um fundo e um texto que não se leem.
 */
import { HEXADECIMAL, normalizarHex } from './hex';
import { hexParaOklch } from './oklch';

export { normalizarHex };

export type NivelDeContraste = 'normal' | 'alto';

export type Sementes = {
  /** Hexadecimal. O modo (claro ou escuro) sai da claridade dele. */
  readonly fundo: string;
  /** Hexadecimal. Qualquer cor. */
  readonly destaque: string;
  readonly contraste: NivelDeContraste;
};

export type Modo = 'claro' | 'escuro';

/** Acima desta claridade perceptual (OKLCH) o fundo é tratado como claro. */
const CORTE_DE_MODO = 0.6;

export function modoDe(fundo: string): Modo {
  return hexParaOklch(fundo).l >= CORTE_DE_MODO ? 'claro' : 'escuro';
}

export function ehSementes(valor: unknown): valor is Sementes {
  if (typeof valor !== 'object' || valor === null) {
    return false;
  }

  const { fundo, destaque, contraste } = valor as Record<string, unknown>;

  return (
    ehHex(fundo) &&
    ehHex(destaque) &&
    (contraste === 'normal' || contraste === 'alto')
  );
}

function ehHex(valor: unknown): boolean {
  return typeof valor === 'string' && HEXADECIMAL.test(valor);
}

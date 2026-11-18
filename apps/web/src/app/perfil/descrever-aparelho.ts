/**
 * Uma descrição curta de um `userAgent`, para a pessoa reconhecer o aparelho
 * na lista de sessões ("Firefox · Windows").
 *
 * Não é detecção de navegador para decidir comportamento: só um rótulo. Por
 * isso uma lista de regras simples basta, e o que não for reconhecido cai num
 * texto neutro em vez de exibir a string crua.
 */

/**
 * A ordem importa: os rastros se sobrepõem. O Edge e o Opera dizem "Chrome" e
 * "Safari" também; o Chrome diz "Safari". Vence a primeira regra que casa.
 */
const NAVEGADORES: readonly (readonly [RegExp, string])[] = [
  [/Edg(e|A|iOS)?\//, 'Edge'],
  [/OPR\/|Opera/, 'Opera'],
  [/Firefox\/|FxiOS\//, 'Firefox'],
  [/Chrome\/|CriOS\//, 'Chrome'],
  [/Safari\//, 'Safari'],
];

/** Android e iOS antes de Linux e macOS: o Android diz "Linux", o iOS diz "Mac OS X". */
const SISTEMAS: readonly (readonly [RegExp, string])[] = [
  [/Android/, 'Android'],
  [/iPhone|iPad|iPod/, 'iOS'],
  [/Windows/, 'Windows'],
  [/Mac OS X|Macintosh/, 'macOS'],
  [/Linux|X11/, 'Linux'],
];

const DESCONHECIDO = 'Aparelho desconhecido';

export function descreverAparelho(userAgent: string | null): string {
  const navegador = primeiraRegraQueCasa(NAVEGADORES, userAgent);
  if (!navegador) {
    return DESCONHECIDO;
  }

  const sistema = primeiraRegraQueCasa(SISTEMAS, userAgent);
  return sistema ? `${navegador} · ${sistema}` : navegador;
}

function primeiraRegraQueCasa(
  regras: readonly (readonly [RegExp, string])[],
  texto: string | null,
): string | null {
  if (!texto) {
    return null;
  }
  return regras.find(([padrao]) => padrao.test(texto))?.[1] ?? null;
}

/**
 * Conversão dos tokens para CSS custom properties.
 *
 * Os tokens são declarados em TypeScript (fonte única da verdade) e viram
 * variáveis CSS para a página. É o que permite trocar de tema em runtime sem
 * recompilar: redefinir os semânticos basta, e nenhum componente é tocado.
 * Ver docs/04-design-system.md.
 */

export type TokenValue = string | number;
export type TokenSet = Record<string, TokenValue>;

/**
 * `surfaceRaised` → `surface-raised`, `space900` → `space-900`.
 *
 * CSS não aceita maiúsculas em nome de variável, e o degrau numérico da paleta
 * é separado para que o nome publicado seja `--color-space-900`, como o design
 * system especifica.
 */
function toKebabCase(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/([a-zA-Z])(\d)/g, '$1-$2')
    .toLowerCase();
}

/**
 * Converte um conjunto de tokens em declarações de custom property, uma por linha.
 *
 * @param tokens conjunto de tokens, com nomes em camelCase
 * @param prefix camada do token (`color`, `space`, `radius`…), obrigatório
 */
export function toCssVariables(tokens: TokenSet, prefix: string): string {
  if (prefix.length === 0) {
    throw new Error('O prefixo do token não pode ser vazio');
  }

  return Object.entries(tokens)
    .map(([name, value]) => `--${prefix}-${toKebabCase(name)}: ${value};`)
    .join('\n');
}

/**
 * Envolve os tokens num seletor, pronto para injetar na página ou escrever em
 * arquivo.
 */
export function toCssRule(selector: string, tokens: TokenSet, prefix: string): string {
  const declarations = toCssVariables(tokens, prefix)
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n');

  return `${selector} {\n${declarations}\n}`;
}

/**
 * As iniciais que fazem as vezes de avatar enquanto não há upload de imagem.
 *
 * Primeira letra do primeiro e do último nome. `Array.from` em vez de `[0]`:
 * indexar uma string parte pontos de código fora do plano básico ao meio, e o
 * avatar viria como um símbolo quebrado.
 */
export function iniciaisDe(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  const primeiro = partes[0];
  if (primeiro === undefined) {
    return '?';
  }

  const ultimo = partes.length > 1 ? partes[partes.length - 1] : undefined;
  const letras = [primeiro, ultimo].flatMap((parte) =>
    parte === undefined ? [] : [Array.from(parte)[0]?.toUpperCase() ?? ''],
  );

  return letras.join('');
}

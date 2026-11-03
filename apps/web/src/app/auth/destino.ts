/**
 * Para onde ir depois de entrar ou criar a conta.
 *
 * O guard guarda o destino em `voltarPara`, e o convite também: quem segue o
 * link do e-mail sem sessão passa por login ou cadastro e precisa voltar ao
 * convite, em vez de cair no calendário sem saber o que aconteceu com ele.
 */

const RAIZ = '/';

/**
 * Só caminho da própria aplicação.
 *
 * Um `voltarPara=https://outro-site` viraria redirect aberto, e o login do
 * Norbit passaria a servir de trampolim. `//host` e `/\host` começam com barra
 * e mesmo assim o navegador os trata como outro host — por isso não basta
 * conferir o primeiro caractere.
 */
export function destinoSeguro(voltarPara: string | null): string {
  if (!voltarPara?.startsWith('/')) {
    return RAIZ;
  }

  const segundo = voltarPara[1];
  return segundo === '/' || segundo === '\\' ? RAIZ : voltarPara;
}

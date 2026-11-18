/**
 * Uma sessão ativa, como a lista de aparelhos a mostra.
 *
 * Um aparelho é uma família de sessões: `id` é o identificador da família, o
 * mesmo que `DELETE /auth/sessoes/:id` aceita. O refresh token e o seu hash
 * nunca saem do servidor.
 */
export type SessaoAtiva = {
  readonly id: string;
  /** Do último login ou renovação; pode ser nulo se o cliente não o enviou. */
  readonly userAgent: string | null;
  readonly ipAddress: string | null;
  /** Quando o aparelho renovou a sessão pela última vez (ISO 8601). */
  readonly ultimoUsoEm: string;
  /** Este é o aparelho de quem pediu a lista. */
  readonly atual: boolean;
};

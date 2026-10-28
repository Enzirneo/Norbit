/**
 * A regra de rotação de refresh token.
 *
 * Função pura, sem banco e sem Nest, para que a decisão de segurança possa ser
 * exercitada em todos os seus casos sem subir infraestrutura. Quem persiste e
 * quem revoga é o `AuthService`; aqui só se decide o quê.
 *
 * O desenho: cada refresh é de uso único. Ao ser usado, é revogado e um novo
 * toma o seu lugar na mesma família. Então um token revogado reaparecendo
 * significa que existe uma cópia dele em circulação — e a resposta correta não
 * é recusar só aquela requisição, é derrubar a família inteira, porque não há
 * como saber se o legítimo é quem acabou de chegar ou quem rotacionou antes.
 */

/** O mínimo que a decisão precisa saber de uma sessão. */
export type SessaoParaRotacao = {
  readonly revokedAt: Date | null;
  readonly expiresAt: Date;
};

export type DecisaoDeRotacao =
  /** Caminho feliz: emitir um novo par e revogar o token apresentado. */
  | { readonly tipo: 'rotacionar' }
  /** Nenhuma sessão corresponde ao token: recusar, sem mais consequências. */
  | { readonly tipo: 'desconhecida' }
  /** Token já rotacionado reapresentado: revogar a família toda. */
  | { readonly tipo: 'reuso-detectado' }
  /** Sessão venceu naturalmente: recusar e pedir login de novo. */
  | { readonly tipo: 'expirada' };

export function avaliarRotacao(
  sessao: SessaoParaRotacao | null,
  agora: Date,
): DecisaoDeRotacao {
  if (sessao === null) {
    return { tipo: 'desconhecida' };
  }

  // Antes da expiração, de propósito: uma sessão revogada *e* expirada que
  // reaparece continua sendo sinal de cópia indevida, e tratá-la apenas como
  // expirada jogaria fora a detecção.
  if (sessao.revokedAt !== null) {
    return { tipo: 'reuso-detectado' };
  }

  // Inclusivo: expirar exatamente agora já é estar expirado.
  if (sessao.expiresAt.getTime() <= agora.getTime()) {
    return { tipo: 'expirada' };
  }

  return { tipo: 'rotacionar' };
}

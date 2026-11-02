/**
 * A regra do link de redefinição de senha.
 *
 * O link é uma credencial de curta duração: quem o apresenta troca a senha da
 * conta sem saber a antiga. Cada link vale **uma vez** e vence depressa; o
 * tempo curto limita o estrago de um e-mail que ficou aberto numa tela alheia.
 *
 * Função pura, sem banco e sem Nest. Quem persiste é o serviço; aqui só se
 * decide o quê.
 */

/**
 * Meia hora. Longo o bastante para abrir o e-mail e pensar numa senha; curto o
 * bastante para o link não sobreviver ao dia.
 */
export const VALIDADE_DO_LINK_EM_MINUTOS = 30;

export type LinkDeRedefinicao = {
  readonly usedAt: Date | null;
  readonly expiresAt: Date;
};

export type DecisaoDeRedefinicao =
  | { readonly tipo: 'aceitar' }
  | { readonly tipo: 'desconhecido' }
  | { readonly tipo: 'ja-usado' }
  | { readonly tipo: 'expirado' };

export function expiracaoDoLink(agora: Date): Date {
  return new Date(agora.getTime() + VALIDADE_DO_LINK_EM_MINUTOS * 60_000);
}

/**
 * O uso tem precedência sobre a expiração: um link usado que reaparece depois
 * de vencido continua sendo reuso, e é a distinção que importa para quem lê o
 * log.
 */
export function avaliarRedefinicao(
  link: LinkDeRedefinicao | null,
  agora: Date,
): DecisaoDeRedefinicao {
  if (!link) {
    return { tipo: 'desconhecido' };
  }

  if (link.usedAt !== null) {
    return { tipo: 'ja-usado' };
  }

  if (link.expiresAt.getTime() <= agora.getTime()) {
    return { tipo: 'expirado' };
  }

  return { tipo: 'aceitar' };
}

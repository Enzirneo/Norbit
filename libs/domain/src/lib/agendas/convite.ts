/**
 * A regra de aceitar um convite para uma agenda.
 *
 * O convite é uma credencial: quem o apresenta entra numa agenda compartilhada.
 * Cada motivo de recusa tem uma resposta própria, porque a pessoa do outro lado
 * precisa saber o que fazer — pedir outro convite, entrar com outra conta, ou
 * nada, porque já está dentro.
 *
 * Função pura, sem banco e sem Nest. Quem persiste é o serviço.
 */

export type StatusDeConvite =
  'PENDING' | 'ACCEPTED' | 'DECLINED' | 'REVOKED' | 'EXPIRED';

export type ConviteAvaliavel = {
  readonly status: StatusDeConvite;
  /** Nulo no convite por link, que serve a qualquer conta. */
  readonly email: string | null;
  readonly expiresAt: Date;
  /** Nulo = sem limite de usos. */
  readonly maxUses: number | null;
  readonly useCount: number;
};

export type QuemAceita = {
  readonly email: string;
  readonly jaEhMembro: boolean;
};

export type DecisaoDeConvite =
  | { readonly tipo: 'aceitar' }
  | { readonly tipo: 'ja-membro' }
  | { readonly tipo: 'desconhecido' }
  | { readonly tipo: 'revogado' }
  | { readonly tipo: 'recusado' }
  | { readonly tipo: 'ja-usado' }
  | { readonly tipo: 'expirado' }
  | { readonly tipo: 'email-diferente' }
  | { readonly tipo: 'esgotado' };

/**
 * A ordem das verificações é a decisão: cada uma só vale se as anteriores
 * passaram.
 *
 * - O que o **dono** decidiu (revogar) vence tudo, inclusive a expiração e o
 *   fato de a pessoa já estar na agenda: um convite revogado não deve parecer
 *   "tudo certo".
 * - A **validade** do convite (recusado, usado, vencido) vem antes de quem
 *   aceita, porque não depende de quem é.
 * - Por fim, **quem aceita**: o e-mail, e só então "já é membro", que devolve
 *   sucesso sem consumir um uso.
 */
/**
 * O que cada status, por si só, decide. `PENDING` não está aqui: é o único que
 * segue para as verificações que dependem do instante e de quem aceita.
 *
 * Uma tabela, e não uma cadeia de `if`: a ordem entre estes quatro não importa
 * (cada status é exclusivo), e a tabela deixa isso visível.
 */
const RECUSA_POR_STATUS: Partial<Record<StatusDeConvite, DecisaoDeConvite>> = {
  REVOKED: { tipo: 'revogado' },
  DECLINED: { tipo: 'recusado' },
  ACCEPTED: { tipo: 'ja-usado' },
  EXPIRED: { tipo: 'expirado' },
};

export function avaliarConvite(
  convite: ConviteAvaliavel | null,
  quem: QuemAceita,
  agora: Date,
): DecisaoDeConvite {
  if (!convite) {
    return { tipo: 'desconhecido' };
  }

  const porStatus = RECUSA_POR_STATUS[convite.status];
  if (porStatus) {
    return porStatus;
  }
  if (convite.expiresAt.getTime() <= agora.getTime()) {
    return { tipo: 'expirado' };
  }

  if (convite.email !== null && !mesmoEmail(convite.email, quem.email)) {
    return { tipo: 'email-diferente' };
  }

  if (quem.jaEhMembro) {
    return { tipo: 'ja-membro' };
  }

  if (convite.maxUses !== null && convite.useCount >= convite.maxUses) {
    return { tipo: 'esgotado' };
  }

  return { tipo: 'aceitar' };
}

/** O e-mail é `citext` no banco: caixa e espaços não distinguem contas. */
function mesmoEmail(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

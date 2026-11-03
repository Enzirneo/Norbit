/**
 * Do formulário do dono para o contrato da API.
 *
 * Roda o **mesmo** `criarConviteSchema` que o servidor aplica, e por isso a
 * tela não tem regra própria de e-mail, de validade ou de teto: se o contrato
 * mudar, a tela muda junto.
 */
import { criarConviteSchema } from '@norbit/contracts';
import type { PapelConvidavel } from './papel';

/** O que os campos guardam. Os numéricos são `null` quando estão vazios. */
export type ValoresDoConvite = {
  readonly email: string;
  readonly papel: PapelConvidavel;
  readonly validadeDias: number | null;
  readonly usosMaximos: number | null;
};

export function validarConvite(
  valores: ValoresDoConvite,
): ReturnType<typeof criarConviteSchema.safeParse> {
  // Espaços sobrando não são um endereço: o campo de só espaços é "sem e-mail".
  const email = valores.email.trim();
  const porEmail = email !== '';

  return criarConviteSchema.safeParse({
    email: porEmail ? email : undefined,
    papel: valores.papel,
    // Vazio vira `undefined` para valer o padrão do contrato (7 dias), e não
    // `null`, que o schema recusaria.
    validadeDias: valores.validadeDias ?? undefined,
    // O convite por e-mail é de um uso só; o teto escolhido para um link que
    // depois virou e-mail não deve viajar junto.
    usosMaximos: porEmail ? undefined : (valores.usosMaximos ?? undefined),
  });
}

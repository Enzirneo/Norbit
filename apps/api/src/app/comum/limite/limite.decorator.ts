import { SetMetadata } from '@nestjs/common';
import type { RegraDeLimite } from '@norbit/domain';

export const CHAVE_DO_LIMITE = 'norbit:limite';

/**
 * As regras de uma rota, por escopo.
 *
 * - `ip`: quantas tentativas a mesma origem pode fazer;
 * - `email`: quantas podem mirar o mesmo e-mail, de qualquer origem. É o que
 *   protege uma conta de ser martelada por muitos IPs e uma caixa de entrada de
 *   ser inundada de e-mails de recuperação.
 */
export type RegrasDaRota = {
  readonly ip?: RegraDeLimite;
  readonly email?: RegraDeLimite;
};

export const Limitar = (regras: RegrasDaRota): MethodDecorator =>
  SetMetadata(CHAVE_DO_LIMITE, regras);

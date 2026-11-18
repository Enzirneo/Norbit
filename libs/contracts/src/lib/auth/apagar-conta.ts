/**
 * Apagar a própria conta.
 *
 * Pede a senha: quem pegasse um aparelho desbloqueado não deve conseguir
 * apagar a conta de outra pessoa. Como em `trocarSenhaSchema`, a senha não
 * passa pela política de tamanho (a conta pode ser anterior a ela); o teto
 * existe só porque o Argon2id gasta CPU proporcional à entrada.
 */
import { z } from 'zod';

export const apagarContaSchema = z
  .object({
    senha: z
      .string()
      .min(1, 'Informe a senha.')
      .max(200, 'A senha é longa demais.'),
  })
  .strip();

export type ApagarConta = z.infer<typeof apagarContaSchema>;

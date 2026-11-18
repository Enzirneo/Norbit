/**
 * Contratos da troca de e-mail.
 *
 * Pede a senha, como a troca de senha e o apagar da conta: o e-mail é o destino
 * da recuperação, então quem o controla controla a conta. A senha não passa
 * pela política de tamanho (a conta pode ser anterior a ela); o teto existe só
 * porque o Argon2id gasta CPU proporcional à entrada.
 */
import { z } from 'zod';
import { email } from './cadastro';

export const trocarEmailSchema = z
  .object({
    senha: z
      .string()
      .min(1, 'Informe a senha.')
      .max(200, 'A senha é longa demais.'),
    novoEmail: email,
  })
  .strip();

export const confirmarEmailSchema = z
  .object({
    // O token é opaco e gerado pelo servidor; aqui só se barra o absurdo.
    token: z.string().min(1, 'O link está incompleto.').max(200),
  })
  .strip();

export type TrocarEmail = z.infer<typeof trocarEmailSchema>;
export type ConfirmarEmail = z.infer<typeof confirmarEmailSchema>;

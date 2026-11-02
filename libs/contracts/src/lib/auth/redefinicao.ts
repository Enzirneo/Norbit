/**
 * Contratos da recuperação de senha.
 *
 * A regra da senha nova é a mesma do cadastro, importada e não copiada: duas
 * cópias divergem, e a divergência seria uma conta que se cadastra com uma
 * senha que a recuperação depois recusa.
 */
import { z } from 'zod';
import { email, senhaNova } from './cadastro';

export const esqueciSenhaSchema = z.object({ email }).strip();

export const redefinirSenhaSchema = z
  .object({
    // O token é opaco e gerado pelo servidor; aqui só se barra o absurdo. Sem
    // teto, um corpo enorme chegaria ao hash antes de ser recusado.
    token: z.string().min(1, 'O link está incompleto.').max(200),
    password: senhaNova,
  })
  .strip();

export type EsqueciSenha = z.infer<typeof esqueciSenhaSchema>;
export type RedefinirSenha = z.infer<typeof redefinirSenhaSchema>;

/**
 * Trocar a senha estando logado.
 *
 * A senha nova segue a regra do cadastro, importada e não copiada. A atual não:
 * a conta pode ser anterior a uma política mais rígida, e recusar por tamanho
 * aqui impediria justamente de trocar uma senha antiga e fraca. O teto existe
 * só porque o Argon2id gasta CPU proporcional à entrada.
 */
import { z } from 'zod';
import { senhaNova } from './cadastro';

export const trocarSenhaSchema = z
  .object({
    senhaAtual: z
      .string()
      .min(1, 'Informe a senha atual.')
      .max(200, 'A senha é longa demais.'),
    novaSenha: senhaNova,
  })
  .strip()
  .refine((dados) => dados.novaSenha !== dados.senhaAtual, {
    message: 'A senha nova precisa ser diferente da atual.',
    path: ['novaSenha'],
  });

export type TrocarSenha = z.infer<typeof trocarSenhaSchema>;

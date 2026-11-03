/**
 * O que a pessoa pode alterar no próprio perfil.
 *
 * As regras de nome e de handle são as do cadastro, importadas: duas cópias
 * divergem, e a divergência seria um handle que o cadastro aceita e a edição
 * recusa. O e-mail fica de fora de propósito — é a credencial da conta, e
 * trocá-lo pede confirmação por e-mail, que é entrega própria. O avatar também:
 * não há onde guardar arquivo ainda.
 */
import { z } from 'zod';
import { fusoIana } from '../agendas/comum';
import { handle, nomeDeExibicao } from './cadastro';

export const atualizarPerfilSchema = z
  .object({
    displayName: nomeDeExibicao.optional(),
    handle: handle.optional(),
    timeZone: fusoIana.optional(),
  })
  .strip()
  .refine((dados) => Object.keys(dados).length > 0, {
    message: 'Informe ao menos um campo para alterar.',
  });

export type AtualizarPerfil = z.infer<typeof atualizarPerfilSchema>;

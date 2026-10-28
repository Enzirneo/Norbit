/**
 * Valida o corpo da requisição com um schema Zod de `@norbit/contracts`.
 *
 * Existe para que a API aplique exatamente o mesmo schema que o formulário do
 * Angular — uma regra, não duas cópias que divergem na primeira alteração.
 */
import { BadRequestException, type PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';

export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  // O segundo parâmetro da interface (`ArgumentMetadata`) é omitido de
  // propósito: o schema já sabe o que validar, e declarar sem usar vira ruído.
  transform(valor: unknown): T {
    const resultado = this.schema.safeParse(valor);

    if (!resultado.success) {
      // Uma mensagem por campo: a interface precisa saber onde mostrar o erro,
      // e um texto corrido não serve para isso.
      throw new BadRequestException({
        message: 'Dados inválidos.',
        campos: resultado.error.issues.map((problema) => ({
          campo: problema.path.join('.'),
          mensagem: problema.message,
        })),
      });
    }

    return resultado.data;
  }
}

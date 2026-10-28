/**
 * Entrega ao controller quem está fazendo a requisição.
 *
 * Lê o que o `AuthGuard` anexou. Se o guard não rodou na rota, lançar aqui é
 * melhor que devolver `undefined`: o erro aparece na primeira chamada, em vez
 * de virar uma consulta com `userId` indefinido que retorna dado de outra
 * pessoa ou de ninguém.
 */
import {
  createParamDecorator,
  type ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';
import type { Requisitante, RequisicaoAutenticada } from './auth.guard';

export const UsuarioAtual = createParamDecorator(
  (_dados: unknown, contexto: ExecutionContext): Requisitante => {
    const requisicao = contexto
      .switchToHttp()
      .getRequest<RequisicaoAutenticada>();

    if (!requisicao.requisitante) {
      throw new InternalServerErrorException(
        'UsuarioAtual usado numa rota sem AuthGuard.',
      );
    }

    return requisicao.requisitante;
  },
);

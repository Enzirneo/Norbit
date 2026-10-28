/**
 * Exige um access token válido no cabeçalho `Authorization`.
 *
 * Só valida a assinatura e o prazo do JWT: não consulta o banco, que é o que
 * torna cada requisição barata. O preço é o access token não ser revogável, e
 * é por isso que ele dura 15 minutos — a revogação de verdade acontece no
 * refresh, que passa pelo banco.
 */
import {
  CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { TokensService } from './tokens.service';

/** O que o guard anexa à requisição, e o que o decorator lê de volta. */
export type Requisitante = {
  readonly id: string;
  readonly handle: string;
};

/** A requisição depois de passar pelo guard. */
export type RequisicaoAutenticada = Request & {
  requisitante?: Requisitante;
};

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly tokens: TokensService) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const requisicao = contexto
      .switchToHttp()
      .getRequest<RequisicaoAutenticada>();

    const token = tokenDoCabecalho(requisicao.headers.authorization);
    if (!token) {
      throw new UnauthorizedException('Autenticação necessária.');
    }

    try {
      const conteudo = await this.tokens.lerAccessToken(token);
      requisicao.requisitante = {
        id: conteudo.sub,
        handle: conteudo.handle,
      };
      return true;
    } catch {
      // Assinatura inválida e token expirado dão a mesma resposta: distinguir
      // não ajuda o cliente, que em ambos os casos precisa renovar.
      throw new UnauthorizedException('Sessão expirada.');
    }
  }
}

function tokenDoCabecalho(cabecalho: string | undefined): string | null {
  if (!cabecalho) {
    return null;
  }

  const [esquema, valor] = cabecalho.split(' ');
  return esquema?.toLowerCase() === 'bearer' && valor ? valor : null;
}

/**
 * Aplica as regras de `@Limitar` a cada requisição, antes do corpo ser validado.
 *
 * Roda antes do `ZodValidationPipe`: o limite precisa valer inclusive para
 * requisições malformadas, que são justamente o que um ataque manda.
 */
import {
  HttpException,
  HttpStatus,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { RegraDeLimite } from '@norbit/domain';
import type { Request, Response } from 'express';
import { CHAVE_DO_LIMITE, type RegrasDaRota } from './limite.decorator';
import { LimiteService } from './limite.service';

@Injectable()
export class LimiteGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
    private readonly limite: LimiteService,
  ) {}

  canActivate(contexto: ExecutionContext): boolean {
    // Os testes de ponta a ponta entram dezenas de vezes seguidas com a mesma
    // conta, da mesma origem: sem esta chave eles se bloqueariam.
    if (this.config.get<string>('LIMITE_DE_FREQUENCIA') === 'desligado') {
      return true;
    }

    const regras = this.reflector.get<RegrasDaRota | undefined>(
      CHAVE_DO_LIMITE,
      contexto.getHandler(),
    );
    if (!regras) {
      return true;
    }

    const requisicao = contexto.switchToHttp().getRequest<Request>();
    const rota = `${contexto.getClass().name}.${contexto.getHandler().name}`;

    const consultas: [string, RegraDeLimite][] = [];
    if (regras.ip) {
      consultas.push([
        `${rota}:ip:${requisicao.ip ?? 'desconhecido'}`,
        regras.ip,
      ]);
    }
    const email = emailDoCorpo(requisicao.body);
    if (regras.email && email !== null) {
      consultas.push([`${rota}:email:${email}`, regras.email]);
    }

    for (const [chave, regra] of consultas) {
      const veredito = this.limite.tentar(chave, regra);
      if (!veredito.permitido) {
        this.recusar(contexto, veredito.tentarDeNovoEmMs);
      }
    }

    return true;
  }

  private recusar(contexto: ExecutionContext, esperaMs: number): never {
    const segundos = Math.ceil(esperaMs / 1000);
    contexto
      .switchToHttp()
      .getResponse<Response>()
      .setHeader('Retry-After', String(segundos));

    throw new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: `Muitas tentativas. Tente de novo ${descreverEspera(segundos)}.`,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

/**
 * O e-mail do corpo, normalizado como o contrato faz (aparado e em minúsculas).
 *
 * Sem normalizar, `A@x.com` e `a@x.com` seriam dois contadores para o limite e
 * uma conta só para o banco (a coluna é `citext`). Corpo sem e-mail, ou com
 * e-mail que não é texto, devolve `null` e fica só com o limite por IP.
 */
function emailDoCorpo(corpo: unknown): string | null {
  if (typeof corpo !== 'object' || corpo === null || !('email' in corpo)) {
    return null;
  }
  const valor = (corpo as { email: unknown }).email;
  return typeof valor === 'string' && valor.trim() !== ''
    ? valor.trim().toLowerCase()
    : null;
}

function descreverEspera(segundos: number): string {
  if (segundos < 60) {
    return `em ${segundos} segundo${segundos === 1 ? '' : 's'}`;
  }
  const minutos = Math.ceil(segundos / 60);
  if (minutos < 60) {
    return `em ${minutos} minuto${minutos === 1 ? '' : 's'}`;
  }
  const horas = Math.ceil(minutos / 60);
  return `em ${horas} hora${horas === 1 ? '' : 's'}`;
}

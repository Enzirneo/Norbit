/**
 * Os aparelhos com a conta aberta, e derrubar um deles.
 *
 * Pelo `AuthGuard`: quem pede já está dentro. O refresh vem do cookie só para o
 * serviço marcar (e proteger) o aparelho de quem pede; não autentica nada aqui.
 */
import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { SessaoAtiva } from '@norbit/contracts';
import type { Request } from 'express';
import { AuthGuard, type Requisitante } from './auth.guard';
import { refreshDoCookie } from './cookie-de-refresh';
import { SessoesService } from './sessoes.service';
import { UsuarioAtual } from './usuario-atual.decorator';

@Controller('auth/sessoes')
@UseGuards(AuthGuard)
export class SessoesController {
  constructor(private readonly sessoes: SessoesService) {}

  @Get()
  listar(
    @UsuarioAtual() quem: Requisitante,
    @Req() requisicao: Request,
  ): Promise<SessaoAtiva[]> {
    return this.sessoes.listar({
      userId: quem.id,
      refreshToken: refreshDoCookie(requisicao),
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revogar(
    @UsuarioAtual() quem: Requisitante,
    @Req() requisicao: Request,
    @Param('id', ParseUUIDPipe) sessaoId: string,
  ): Promise<void> {
    await this.sessoes.revogar({
      userId: quem.id,
      sessaoId,
      refreshToken: refreshDoCookie(requisicao),
    });
  }
}

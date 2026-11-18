/**
 * Apagar a própria conta.
 *
 * Pelo `AuthGuard`: quem pede já está dentro, e a prova que falta é a senha.
 * Limitada por IP como a troca de senha: um access token roubado serviria,
 * aqui também, para adivinhar a senha.
 */
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { apagarContaSchema, type ApagarConta } from '@norbit/contracts';
import type { Response } from 'express';
import { Limitar } from '../comum/limite/limite.decorator';
import { LimiteGuard } from '../comum/limite/limite.guard';
import { ZodValidationPipe } from '../comum/zod-validation.pipe';
import { ApagarContaService } from './apagar-conta.service';
import { AuthGuard, type Requisitante } from './auth.guard';
import { COOKIE_DE_REFRESH, opcoesDoCookie } from './cookie-de-refresh';
import { UsuarioAtual } from './usuario-atual.decorator';

const QUINZE_MINUTOS = 15 * 60_000;

@Controller('auth')
export class ContaController {
  constructor(
    private readonly apagarConta: ApagarContaService,
    private readonly config: ConfigService,
  ) {}

  @Post('apagar-conta')
  @UseGuards(AuthGuard, LimiteGuard)
  @Limitar({ ip: { maximo: 10, janelaMs: QUINZE_MINUTOS } })
  @HttpCode(HttpStatus.NO_CONTENT)
  async apagar(
    @UsuarioAtual() quem: Requisitante,
    @Body(new ZodValidationPipe(apagarContaSchema)) dados: ApagarConta,
    @Res({ passthrough: true }) resposta: Response,
  ): Promise<void> {
    await this.apagarConta.apagar({ userId: quem.id, senha: dados.senha });

    // Todas as sessões já foram revogadas; limpar o cookie evita que este
    // navegador tente renová-la.
    resposta.clearCookie(COOKIE_DE_REFRESH, opcoesDoCookie(this.config));
  }
}

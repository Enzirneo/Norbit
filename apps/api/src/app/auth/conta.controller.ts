/**
 * Operações sobre a própria conta: apagá-la e trocar o e-mail.
 *
 * As que pedem a senha passam pelo `AuthGuard` (quem pede já está dentro, e a
 * prova que falta é a senha) e são limitadas por IP como a troca de senha: um
 * access token roubado serviria, aqui também, para adivinhar a senha.
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
import {
  apagarContaSchema,
  confirmarEmailSchema,
  trocarEmailSchema,
  type ApagarConta,
  type ConfirmarEmail,
  type TrocarEmail,
} from '@norbit/contracts';
import type { Response } from 'express';
import { Limitar } from '../comum/limite/limite.decorator';
import { LimiteGuard } from '../comum/limite/limite.guard';
import { ZodValidationPipe } from '../comum/zod-validation.pipe';
import { ApagarContaService } from './apagar-conta.service';
import { AuthGuard, type Requisitante } from './auth.guard';
import { COOKIE_DE_REFRESH, opcoesDoCookie } from './cookie-de-refresh';
import { TrocaDeEmailService } from './troca-de-email.service';
import { UsuarioAtual } from './usuario-atual.decorator';

const QUINZE_MINUTOS = 15 * 60_000;
const UMA_HORA = 60 * 60_000;

@Controller('auth')
export class ContaController {
  constructor(
    private readonly apagarConta: ApagarContaService,
    private readonly trocaDeEmail: TrocaDeEmailService,
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

  /**
   * 204 haja ou não conta no endereço novo: ver `pedir` no serviço.
   */
  @Post('trocar-email')
  @UseGuards(AuthGuard, LimiteGuard)
  @Limitar({ ip: { maximo: 10, janelaMs: QUINZE_MINUTOS } })
  @HttpCode(HttpStatus.NO_CONTENT)
  async trocarEmail(
    @UsuarioAtual() quem: Requisitante,
    @Body(new ZodValidationPipe(trocarEmailSchema)) dados: TrocarEmail,
  ): Promise<void> {
    await this.trocaDeEmail.pedir({
      userId: quem.id,
      senha: dados.senha,
      novoEmail: dados.novoEmail,
    });
  }

  /**
   * Pública: quem clica no link pode estar em outro aparelho, sem sessão. O
   * token tem 256 bits e não é adivinhável; o limite só contém abuso.
   */
  @Post('confirmar-email')
  @UseGuards(LimiteGuard)
  @Limitar({ ip: { maximo: 20, janelaMs: UMA_HORA } })
  @HttpCode(HttpStatus.NO_CONTENT)
  async confirmarEmail(
    @Body(new ZodValidationPipe(confirmarEmailSchema)) dados: ConfirmarEmail,
  ): Promise<void> {
    await this.trocaDeEmail.confirmar(dados.token);
  }
}

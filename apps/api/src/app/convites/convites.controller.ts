/**
 * As rotas dos convites, em dois controllers porque têm donos diferentes.
 *
 * - `agendas/:id/convites` é do **dono da agenda**: criar, listar, revogar.
 * - `convites/:token` é de **quem recebeu o link**: ver, aceitar, recusar. A
 *   previsão é pública, de propósito — quem recebe o link precisa saber de quê
 *   está sendo convidado antes de decidir criar conta.
 */
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  criarConviteSchema,
  type ConviteCriado,
  type ConviteVisivel,
  type CriarConvite,
  type PrevisaoDeConvite,
} from '@norbit/contracts';
import { AuthGuard } from '../auth/auth.guard';
import type { Requisitante } from '../auth/auth.guard';
import { UsuarioAtual } from '../auth/usuario-atual.decorator';
import { Limitar } from '../comum/limite/limite.decorator';
import { LimiteGuard } from '../comum/limite/limite.guard';
import { ZodValidationPipe } from '../comum/zod-validation.pipe';
import { ConvitesService } from './convites.service';

const UMA_HORA = 3_600_000;

const UUID_V7 = new ParseUUIDPipe({ version: '7' });

@Controller('agendas/:id/convites')
@UseGuards(AuthGuard)
export class ConvitesDaAgendaController {
  constructor(private readonly convites: ConvitesService) {}

  /**
   * Limitado por e-mail: é o que impede o dono — ou quem roubou a sessão dele —
   * de inundar a caixa de entrada de alguém com convites.
   */
  @Post()
  @UseGuards(LimiteGuard)
  @Limitar({
    ip: { maximo: 60, janelaMs: UMA_HORA },
    email: { maximo: 5, janelaMs: UMA_HORA },
  })
  async criar(
    @UsuarioAtual() quem: Requisitante,
    @Param('id', UUID_V7) calendarId: string,
    @Body(new ZodValidationPipe(criarConviteSchema)) dados: CriarConvite,
  ): Promise<ConviteCriado> {
    return this.convites.criar(quem.id, calendarId, dados);
  }

  @Get()
  async listar(
    @UsuarioAtual() quem: Requisitante,
    @Param('id', UUID_V7) calendarId: string,
  ): Promise<ConviteVisivel[]> {
    return this.convites.listar(quem.id, calendarId);
  }

  @Delete(':conviteId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revogar(
    @UsuarioAtual() quem: Requisitante,
    @Param('id', UUID_V7) calendarId: string,
    @Param('conviteId', UUID_V7) conviteId: string,
  ): Promise<void> {
    await this.convites.revogar(quem.id, calendarId, conviteId);
  }
}

@Controller('convites')
export class ConvitesController {
  constructor(private readonly convites: ConvitesService) {}

  @Get(':token')
  @UseGuards(LimiteGuard)
  @Limitar({ ip: { maximo: 60, janelaMs: UMA_HORA } })
  async previsao(@Param('token') token: string): Promise<PrevisaoDeConvite> {
    return this.convites.previsao(token);
  }

  @Post(':token/aceitar')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, LimiteGuard)
  @Limitar({ ip: { maximo: 30, janelaMs: UMA_HORA } })
  async aceitar(
    @UsuarioAtual() quem: Requisitante,
    @Param('token') token: string,
  ): Promise<{ calendarId: string }> {
    return this.convites.aceitar(quem.id, token);
  }

  @Post(':token/recusar')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard)
  async recusar(
    @UsuarioAtual() quem: Requisitante,
    @Param('token') token: string,
  ): Promise<void> {
    await this.convites.recusar(quem.id, token);
  }
}

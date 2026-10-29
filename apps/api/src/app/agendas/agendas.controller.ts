/**
 * As rotas das agendas.
 *
 * Toda rota exige sessão, e nenhuma recebe o identificador de quem está pedindo
 * pelo corpo ou pela URL: ele vem do token, por `@UsuarioAtual`. Aceitar um
 * `userId` do cliente seria oferecer a troca de identidade de graça.
 *
 * **O que ainda não existe aqui:** adicionar membro. Entrar numa agenda é por
 * convite (`CalendarInvite`, com token e e-mail), e isso pertence ao bloco de
 * compartilhamento do roadmap. Alterar papel, remover e sair já existem porque
 * são consequência direta da matriz de permissões.
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
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  atualizarAgendaSchema,
  criarAgendaSchema,
  definirPapelSchema,
  type AgendaVisivel,
  type AtualizarAgenda,
  type CriarAgenda,
  type DefinirPapel,
  type MembroVisivel,
} from '@norbit/contracts';
import { AuthGuard } from '../auth/auth.guard';
import type { Requisitante } from '../auth/auth.guard';
import { UsuarioAtual } from '../auth/usuario-atual.decorator';
import { ZodValidationPipe } from '../comum/zod-validation.pipe';
import { AgendasService } from './agendas.service';

/**
 * `ParseUUIDPipe` antes do serviço: um identificador malformado volta como 400
 * em vez de virar consulta ao Postgres, que recusaria o texto com erro de tipo
 * e chegaria ao cliente como 500.
 */
const uuidNaRota = new ParseUUIDPipe({ version: '7' });

@Controller('agendas')
@UseGuards(AuthGuard)
export class AgendasController {
  constructor(private readonly agendas: AgendasService) {}

  @Get()
  async listar(@UsuarioAtual() quem: Requisitante): Promise<AgendaVisivel[]> {
    return this.agendas.listar(quem.id);
  }

  @Post()
  async criar(
    @UsuarioAtual() quem: Requisitante,
    @Body(new ZodValidationPipe(criarAgendaSchema)) dados: CriarAgenda,
  ): Promise<AgendaVisivel> {
    return this.agendas.criar(quem.id, dados);
  }

  @Patch(':id')
  async atualizar(
    @UsuarioAtual() quem: Requisitante,
    @Param('id', uuidNaRota) calendarId: string,
    @Body(new ZodValidationPipe(atualizarAgendaSchema)) dados: AtualizarAgenda,
  ): Promise<AgendaVisivel> {
    return this.agendas.atualizar({ userId: quem.id, calendarId, dados });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remover(
    @UsuarioAtual() quem: Requisitante,
    @Param('id', uuidNaRota) calendarId: string,
  ): Promise<void> {
    await this.agendas.remover(quem.id, calendarId);
  }

  @Get(':id/membros')
  async membros(
    @UsuarioAtual() quem: Requisitante,
    @Param('id', uuidNaRota) calendarId: string,
  ): Promise<MembroVisivel[]> {
    return this.agendas.membros(quem.id, calendarId);
  }

  /**
   * Sair vem **antes** da rota com parâmetro de propósito.
   *
   * O Nest casa as rotas na ordem de declaração, então `:membroId` capturaria
   * o literal `eu` se viesse primeiro — e sair da agenda passaria a exigir
   * `gerenciar-membros`, que é justamente o que esta rota existe para evitar.
   */
  @Delete(':id/membros/eu')
  @HttpCode(HttpStatus.NO_CONTENT)
  async sair(
    @UsuarioAtual() quem: Requisitante,
    @Param('id', uuidNaRota) calendarId: string,
  ): Promise<void> {
    await this.agendas.sair(quem.id, calendarId);
  }

  @Patch(':id/membros/:membroId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async definirPapel(
    @UsuarioAtual() quem: Requisitante,
    @Param('id', uuidNaRota) calendarId: string,
    @Param('membroId', uuidNaRota) membroId: string,
    @Body(new ZodValidationPipe(definirPapelSchema)) dados: DefinirPapel,
  ): Promise<void> {
    await this.agendas.definirPapel({
      userId: quem.id,
      calendarId,
      membroId,
      papel: dados.papel,
    });
  }

  @Delete(':id/membros/:membroId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removerMembro(
    @UsuarioAtual() quem: Requisitante,
    @Param('id', uuidNaRota) calendarId: string,
    @Param('membroId', uuidNaRota) membroId: string,
  ): Promise<void> {
    await this.agendas.removerMembro({
      userId: quem.id,
      calendarId,
      membroId,
    });
  }
}

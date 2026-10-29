/**
 * As rotas das tarefas.
 *
 * Criação sob a agenda, como nos eventos: a agenda é a unidade de permissão, e
 * tê-la na URL deixa a autorização explícita em vez de escondida num campo do
 * corpo.
 *
 * `PATCH /tarefas/:id/posicao` é separado do `PATCH /tarefas/:id` de propósito:
 * reordenar não é editar um campo. Ele recebe **vizinhos**, pode renumerar a
 * lista inteira como efeito, e misturar isso com a alteração de título faria uma
 * rota que às vezes escreve vinte linhas sem o cliente saber por quê.
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
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  atualizarTarefaSchema,
  consultaDeTarefasSchema,
  criarTarefaSchema,
  moverTarefaSchema,
  type AtualizarTarefa,
  type ConsultaDeTarefas,
  type CriarTarefa,
  type MoverTarefa,
  type TarefaVisivel,
} from '@norbit/contracts';
import { AuthGuard } from '../auth/auth.guard';
import type { Requisitante } from '../auth/auth.guard';
import { UsuarioAtual } from '../auth/usuario-atual.decorator';
import { ZodValidationPipe } from '../comum/zod-validation.pipe';
import { TarefasService } from './tarefas.service';

const uuidNaRota = new ParseUUIDPipe({ version: '7' });

@Controller()
@UseGuards(AuthGuard)
export class TarefasController {
  constructor(private readonly tarefas: TarefasService) {}

  @Get('tarefas')
  async listar(
    @UsuarioAtual() quem: Requisitante,
    @Query(new ZodValidationPipe(consultaDeTarefasSchema))
    consulta: ConsultaDeTarefas,
  ): Promise<TarefaVisivel[]> {
    return this.tarefas.listar(quem.id, consulta);
  }

  @Post('agendas/:calendarId/tarefas')
  async criar(
    @UsuarioAtual() quem: Requisitante,
    @Param('calendarId', uuidNaRota) calendarId: string,
    @Body(new ZodValidationPipe(criarTarefaSchema)) dados: CriarTarefa,
  ): Promise<TarefaVisivel> {
    return this.tarefas.criar({ userId: quem.id, calendarId, dados });
  }

  @Patch('tarefas/:id')
  async atualizar(
    @UsuarioAtual() quem: Requisitante,
    @Param('id', uuidNaRota) taskId: string,
    @Body(new ZodValidationPipe(atualizarTarefaSchema)) dados: AtualizarTarefa,
  ): Promise<TarefaVisivel> {
    return this.tarefas.atualizar({ userId: quem.id, taskId, dados });
  }

  @Patch('tarefas/:id/posicao')
  async mover(
    @UsuarioAtual() quem: Requisitante,
    @Param('id', uuidNaRota) taskId: string,
    @Body(new ZodValidationPipe(moverTarefaSchema)) dados: MoverTarefa,
  ): Promise<TarefaVisivel> {
    return this.tarefas.mover({ userId: quem.id, taskId, dados });
  }

  @Delete('tarefas/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remover(
    @UsuarioAtual() quem: Requisitante,
    @Param('id', uuidNaRota) taskId: string,
  ): Promise<void> {
    await this.tarefas.remover(quem.id, taskId);
  }
}

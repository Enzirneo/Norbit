/**
 * As rotas dos eventos.
 *
 * A criação fica sob a agenda (`POST /agendas/:id/eventos`) porque um evento não
 * existe fora de uma: a agenda é a unidade de permissão, e tê-la na URL deixa a
 * autorização explícita em vez de escondida num campo do corpo.
 *
 * As três operações que o usuário espera de uma série recorrente aparecem aqui
 * como três caminhos distintos — ver a tabela em `docs/08-recorrencia.md`:
 *
 * | O que a pessoa faz   | Rota                                             |
 * | -------------------- | ------------------------------------------------ |
 * | editar todos         | `PATCH /eventos/:id`                             |
 * | excluir só este      | `DELETE /eventos/:id/ocorrencias/:inicio`        |
 * | editar só este       | `POST /eventos/:id/ocorrencias/:inicio/destacar` |
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
  atualizarEventoSchema,
  consultaDeEventosSchema,
  criarEventoSchema,
  ocorrenciaSchema,
  type AtualizarEvento,
  type ConsultaDeEventos,
  type CriarEvento,
  type EventoVisivel,
  type OcorrenciaVisivel,
} from '@norbit/contracts';
import { AuthGuard } from '../auth/auth.guard';
import type { Requisitante } from '../auth/auth.guard';
import { UsuarioAtual } from '../auth/usuario-atual.decorator';
import { ZodValidationPipe } from '../comum/zod-validation.pipe';
import { EventosService } from './eventos.service';

const uuidNaRota = new ParseUUIDPipe({ version: '7' });

/**
 * O instante que identifica a ocorrência vem como parâmetro de rota, e um
 * parâmetro de rota é sempre texto: o pipe recebe `{ inicioOriginal }` para
 * reaproveitar o mesmo schema — e a mesma mensagem — da validação do corpo.
 */
const inicioNaRota = {
  transform: (valor: string): Date =>
    new ZodValidationPipe(ocorrenciaSchema).transform({
      inicioOriginal: valor,
    }).inicioOriginal,
};

@Controller()
@UseGuards(AuthGuard)
export class EventosController {
  constructor(private readonly eventos: EventosService) {}

  @Get('eventos')
  async consultar(
    @UsuarioAtual() quem: Requisitante,
    @Query(new ZodValidationPipe(consultaDeEventosSchema))
    consulta: ConsultaDeEventos,
  ): Promise<OcorrenciaVisivel[]> {
    return this.eventos.consultar(quem.id, consulta);
  }

  @Post('agendas/:calendarId/eventos')
  async criar(
    @UsuarioAtual() quem: Requisitante,
    @Param('calendarId', uuidNaRota) calendarId: string,
    @Body(new ZodValidationPipe(criarEventoSchema)) dados: CriarEvento,
  ): Promise<EventoVisivel> {
    return this.eventos.criar({ userId: quem.id, calendarId, dados });
  }

  @Patch('eventos/:id')
  async atualizar(
    @UsuarioAtual() quem: Requisitante,
    @Param('id', uuidNaRota) eventId: string,
    @Body(new ZodValidationPipe(atualizarEventoSchema)) dados: AtualizarEvento,
  ): Promise<EventoVisivel> {
    return this.eventos.atualizar({ userId: quem.id, eventId, dados });
  }

  @Delete('eventos/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remover(
    @UsuarioAtual() quem: Requisitante,
    @Param('id', uuidNaRota) eventId: string,
  ): Promise<void> {
    await this.eventos.remover(quem.id, eventId);
  }

  @Delete('eventos/:id/ocorrencias/:inicio')
  @HttpCode(HttpStatus.NO_CONTENT)
  async excluirOcorrencia(
    @UsuarioAtual() quem: Requisitante,
    @Param('id', uuidNaRota) eventId: string,
    @Param('inicio', inicioNaRota) inicioOriginal: Date,
  ): Promise<void> {
    await this.eventos.excluirOcorrencia({
      userId: quem.id,
      eventId,
      inicioOriginal,
    });
  }

  @Post('eventos/:id/ocorrencias/:inicio/destacar')
  async destacarOcorrencia(
    @UsuarioAtual() quem: Requisitante,
    @Param('id', uuidNaRota) eventId: string,
    @Param('inicio', inicioNaRota) inicioOriginal: Date,
  ): Promise<EventoVisivel> {
    return this.eventos.destacarOcorrencia({
      userId: quem.id,
      eventId,
      inicioOriginal,
    });
  }
}

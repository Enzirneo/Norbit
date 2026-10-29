/**
 * As tarefas: criar, alterar, concluir, excluir, listar e reordenar.
 *
 * Mesma forma dos eventos: quem decide acesso é o `AcessoService`, e toda
 * operação começa por `abrir`. A ordenação manual é a parte que não existe nos
 * eventos, e ela mora no `PosicionamentoService`.
 */
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  AtualizarTarefa,
  ConsultaDeTarefas,
  CriarTarefa,
  MoverTarefa,
  TarefaVisivel,
} from '@norbit/contracts';
import { fimExclusivoDoDia } from '@norbit/domain';
import { PrismaService, type Calendar, type Task } from '@norbit/db';
import { uuidv7 } from 'uuidv7';
import { AcessoService } from '../agendas/acesso.service';
import { PosicionamentoService } from './posicionamento.service';
import { paraTarefaVisivel } from './visivel';

@Injectable()
export class TarefasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acesso: AcessoService,
    private readonly posicoes: PosicionamentoService,
  ) {}

  async listar(
    userId: string,
    consulta: ConsultaDeTarefas,
  ): Promise<TarefaVisivel[]> {
    const minhas = await this.acesso.minhasAgendas(userId);
    const ids = minhas.map(({ agenda }) => agenda.id);
    const permitidas = consulta.agendas
      ? ids.filter((id) => consulta.agendas?.includes(id))
      : ids;

    if (permitidas.length === 0) {
      return [];
    }

    const linhas = await this.prisma.task.findMany({
      where: {
        calendarId: { in: permitidas },
        deletedAt: null,
        ...(consulta.incluirConcluidas ? {} : { completedAt: null }),
        ...(consulta.responsavelId
          ? { assigneeId: consulta.responsavelId }
          : {}),
        // `PRIVATE` some para todo mundo menos quem criou, **na consulta** e não
        // na resposta — a mesma regra dos eventos, pelo mesmo motivo.
        OR: [{ visibility: 'INHERITED' }, { createdById: userId }],
      },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });

    return linhas.map(paraTarefaVisivel);
  }

  async criar(entrada: {
    readonly userId: string;
    readonly calendarId: string;
    readonly dados: CriarTarefa;
  }): Promise<TarefaVisivel> {
    const { agenda } = await this.acesso.abrir({
      calendarId: entrada.calendarId,
      userId: entrada.userId,
      acao: 'criar-tarefa',
    });

    const { dados } = entrada;
    const parentTaskId = dados.parentTaskId ?? null;

    await this.exigirMaeValida(agenda.id, parentTaskId);
    await this.exigirResponsavelMembro(agenda, dados.assigneeId ?? null);

    const criada = await this.prisma.task.create({
      data: {
        id: uuidv7(),
        calendarId: agenda.id,
        createdById: entrada.userId,
        title: dados.title,
        notes: dados.notes ?? null,
        priority: dados.priority,
        dueAt: prazo(dados.dueAt ?? null, dados.isDueAllDay, agenda.timeZone),
        isDueAllDay: dados.isDueAllDay,
        visibility: dados.visibility,
        assigneeId: dados.assigneeId ?? null,
        parentTaskId,
        position: await this.posicoes.noFim(agenda.id, parentTaskId),
      },
    });

    return paraTarefaVisivel(criada);
  }

  async atualizar(entrada: {
    readonly userId: string;
    readonly taskId: string;
    readonly dados: AtualizarTarefa;
  }): Promise<TarefaVisivel> {
    const { tarefa, agenda } = await this.abrir({
      userId: entrada.userId,
      taskId: entrada.taskId,
      acao: 'editar-tarefa',
    });

    const { concluida, ...campos } = entrada.dados;

    if (campos.parentTaskId !== undefined) {
      await this.exigirMaeValida(agenda.id, campos.parentTaskId, tarefa.id);
    }
    if (campos.assigneeId !== undefined) {
      await this.exigirResponsavelMembro(agenda, campos.assigneeId);
    }

    const atualizada = await this.prisma.task.update({
      where: { id: tarefa.id },
      data: {
        ...campos,
        ...this.prazoAtualizado(tarefa, entrada.dados, agenda.timeZone),
        // A data de conclusão é do servidor: o cliente não tem relógio
        // confiável, e "concluída hoje" depende de qual relógio decidiu.
        ...(concluida === undefined
          ? {}
          : { completedAt: concluida ? new Date() : null }),
      },
    });

    return paraTarefaVisivel(atualizada);
  }

  /**
   * Exclusão lógica — da tarefa **e das subtarefas dela**.
   *
   * O `onDelete: Cascade` do banco só vale para exclusão física. Sem levar as
   * filhas junto, elas continuariam na listagem apontando para uma mãe que já
   * não aparece: subtarefa órfã, que a interface não sabe onde desenhar.
   */
  async remover(userId: string, taskId: string): Promise<void> {
    const { tarefa } = await this.abrir({
      userId,
      taskId,
      acao: 'excluir-tarefa',
    });

    const agora = new Date();

    await this.prisma.$transaction([
      this.prisma.task.update({
        where: { id: tarefa.id },
        data: { deletedAt: agora },
      }),
      this.prisma.task.updateMany({
        where: { parentTaskId: tarefa.id, deletedAt: null },
        data: { deletedAt: agora },
      }),
    ]);
  }

  /** Reordena, recebendo o destino pelos vizinhos e não pela posição. */
  async mover(entrada: {
    readonly userId: string;
    readonly taskId: string;
    readonly dados: MoverTarefa;
  }): Promise<TarefaVisivel> {
    const { tarefa } = await this.abrir({
      userId: entrada.userId,
      taskId: entrada.taskId,
      acao: 'editar-tarefa',
    });

    const position = await this.posicoes.mover(tarefa, entrada.dados);

    const movida = await this.prisma.task.update({
      where: { id: tarefa.id },
      data: { position },
    });

    return paraTarefaVisivel(movida);
  }

  // ─── privados ──────────────────────────────────────────────────────────────

  private async abrir(entrada: {
    readonly userId: string;
    readonly taskId: string;
    readonly acao: 'editar-tarefa' | 'excluir-tarefa';
  }): Promise<{ tarefa: Task; agenda: Calendar }> {
    const tarefa = await this.prisma.task.findFirst({
      where: { id: entrada.taskId, deletedAt: null },
    });

    if (!tarefa) {
      throw new NotFoundException('Tarefa não encontrada.');
    }

    const { agenda, papel } = await this.acesso.abrir({
      calendarId: tarefa.calendarId,
      userId: entrada.userId,
      acao: 'ver',
    });

    this.acesso.exigirNoItem({
      papel,
      acao: entrada.acao,
      ehAutor: tarefa.createdById === entrada.userId,
    });

    return { tarefa, agenda };
  }

  /**
   * A tarefa-mãe tem de existir na mesma agenda e **não ter mãe**.
   *
   * Um nível só. Isso mata o ciclo por construção: se a mãe nunca tem mãe, não
   * existe caminho de volta. Verificar ciclo em árvore de profundidade livre
   * exigiria percorrer a cadeia a cada escrita, e o custo de errar é uma
   * listagem que entra em laço.
   */
  private async exigirMaeValida(
    calendarId: string,
    parentTaskId: string | null,
    propriaId?: string,
  ): Promise<void> {
    if (parentTaskId === null) {
      return;
    }

    if (parentTaskId === propriaId) {
      throw new BadRequestException(
        'Uma tarefa não pode ser subtarefa de si mesma.',
      );
    }

    const mae = await this.prisma.task.findFirst({
      where: { id: parentTaskId, calendarId, deletedAt: null },
      select: { parentTaskId: true },
    });

    if (!mae) {
      throw new BadRequestException('A tarefa-mãe não existe nesta agenda.');
    }

    if (mae.parentTaskId !== null) {
      throw new BadRequestException(
        'As subtarefas vão até um nível: escolha uma tarefa principal como mãe.',
      );
    }

    if (propriaId !== undefined) {
      await this.exigirSemFilhas(propriaId);
    }
  }

  /**
   * Uma tarefa com subtarefas não pode virar subtarefa.
   *
   * É o outro lado do limite de um nível: permitir faria as filhas dela ficarem
   * no segundo nível por via indireta, sem passar por nenhuma validação.
   */
  private async exigirSemFilhas(taskId: string): Promise<void> {
    const filhas = await this.prisma.task.count({
      where: { parentTaskId: taskId, deletedAt: null },
    });

    if (filhas > 0) {
      throw new BadRequestException(
        'Esta tarefa tem subtarefas e por isso não pode virar subtarefa de outra.',
      );
    }
  }

  /**
   * Responsável tem de ser membro da agenda.
   *
   * Atribuir a quem não vê a agenda cria uma tarefa que o responsável nunca
   * encontra — e a pessoa que atribuiu acha que delegou.
   */
  private async exigirResponsavelMembro(
    agenda: Calendar,
    assigneeId: string | null,
  ): Promise<void> {
    if (assigneeId === null || assigneeId === agenda.ownerId) {
      return;
    }

    const membro = await this.prisma.calendarMember.count({
      where: { calendarId: agenda.id, userId: assigneeId },
    });

    if (membro === 0) {
      throw new BadRequestException(
        'O responsável precisa ser membro desta agenda.',
      );
    }
  }

  /**
   * O prazo recalculado quando o PATCH mexe nele ou na marca de dia inteiro.
   *
   * As duas coisas se afetam: trocar `isDueAllDay` para `true` sem tocar no
   * `dueAt` precisa normalizar o prazo que já estava lá, ou a tarefa ficaria
   * marcada como "dia inteiro" guardando um horário qualquer.
   */
  private prazoAtualizado(
    tarefa: Task,
    dados: AtualizarTarefa,
    fuso: string,
  ): { dueAt?: Date | null } {
    if (dados.dueAt === undefined && dados.isDueAllDay === undefined) {
      return {};
    }

    const quando = dados.dueAt === undefined ? tarefa.dueAt : dados.dueAt;
    const diaInteiro = dados.isDueAllDay ?? tarefa.isDueAllDay;

    return { dueAt: prazo(quando, diaInteiro, fuso) };
  }
}

function prazo(
  quando: Date | null,
  diaInteiro: boolean,
  fuso: string,
): Date | null {
  if (quando === null || !diaInteiro) {
    return quando;
  }

  return fimExclusivoDoDia(quando, fuso);
}

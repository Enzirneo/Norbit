/**
 * As agendas: criar, listar, alterar, arquivar, excluir, e os membros.
 *
 * Quem decide acesso é o `AcessoService`; aqui só acontece a consequência. Toda
 * operação começa por `abrir`, que é ao mesmo tempo a busca e a autorização —
 * não existe caminho neste arquivo que toque uma agenda sem passar por lá.
 */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  AgendaVisivel,
  AtualizarAgenda,
  CriarAgenda,
  MembroVisivel,
} from '@norbit/contracts';
import type { Papel } from '@norbit/domain';
import { PrismaService } from '@norbit/db';
import { uuidv7 } from 'uuidv7';
import { AcessoService, paraRole, type AcessoAAgenda } from './acesso.service';

/** Os três papéis atribuíveis: a posse não se transfere alterando um papel. */
type PapelAtribuivel = Exclude<Papel, 'OWNER'>;

@Injectable()
export class AgendasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acesso: AcessoService,
  ) {}

  async listar(userId: string): Promise<AgendaVisivel[]> {
    const acessos = await this.acesso.minhasAgendas(userId);
    return acessos.map(visivel);
  }

  /**
   * Cria a agenda e a linha de membro do dono na mesma transação.
   *
   * Sem a transação, uma falha entre as duas escritas deixaria uma agenda fora
   * da listagem de membros — e o dono continuaria entrando por `ownerId`, o que
   * esconderia o defeito até alguém olhar a lista de membros e não se ver nela.
   */
  async criar(userId: string, dados: CriarAgenda): Promise<AgendaVisivel> {
    const usuario = await this.prisma.user.findFirstOrThrow({
      where: { id: userId, deletedAt: null },
      select: { timeZone: true },
    });

    const id = uuidv7();

    const [agenda] = await this.prisma.$transaction([
      this.prisma.calendar.create({
        data: {
          id,
          ownerId: userId,
          name: dados.name,
          description: dados.description ?? null,
          kind: dados.kind,
          color: dados.color,
          icon: dados.icon ?? null,
          // Ausente herda o fuso de quem cria: é o palpite certo em quase todo
          // caso, e quem precisa de outro muda depois.
          timeZone: dados.timeZone ?? usuario.timeZone,
        },
      }),
      this.prisma.calendarMember.create({
        data: { calendarId: id, userId, role: 'OWNER' },
      }),
    ]);

    return visivel({ agenda, papel: 'OWNER' });
  }

  async atualizar(entrada: {
    readonly userId: string;
    readonly calendarId: string;
    readonly dados: AtualizarAgenda;
  }): Promise<AgendaVisivel> {
    const { agenda, papel } = await this.acesso.abrir({
      calendarId: entrada.calendarId,
      userId: entrada.userId,
      acao: 'editar-agenda',
    });

    const { arquivada, ...campos } = entrada.dados;

    const atualizada = await this.prisma.calendar.update({
      where: { id: agenda.id },
      data: {
        ...campos,
        // `arquivada` é booleano para fora e instante para dentro: a data de
        // arquivamento aparece no histórico, e o cliente não precisa inventá-la.
        ...(arquivada === undefined
          ? {}
          : { archivedAt: arquivada ? new Date() : null }),
      },
    });

    return visivel({ agenda: atualizada, papel });
  }

  /**
   * Exclusão lógica.
   *
   * Os eventos ficam no banco e saem das consultas porque toda consulta parte
   * das agendas visíveis. É o que permite um "desfazer" depois, e é o que
   * impede que excluir uma agenda compartilhada destrua o histórico de todos.
   */
  async remover(userId: string, calendarId: string): Promise<void> {
    const { agenda } = await this.acesso.abrir({
      calendarId,
      userId,
      acao: 'excluir-agenda',
    });

    if (agenda.isDefault) {
      throw new ConflictException(
        'A agenda padrão não pode ser excluída. Marque outra como padrão primeiro.',
      );
    }

    await this.prisma.calendar.update({
      where: { id: agenda.id },
      data: { deletedAt: new Date() },
    });
  }

  /** Ver os membros exige só ver a agenda: quem está dentro sabe com quem divide. */
  async membros(userId: string, calendarId: string): Promise<MembroVisivel[]> {
    const { agenda } = await this.acesso.abrir({
      calendarId,
      userId,
      acao: 'ver',
    });

    const linhas = await this.prisma.calendarMember.findMany({
      where: { calendarId: agenda.id },
      include: {
        user: {
          select: {
            id: true,
            handle: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    return linhas.map((linha) => ({
      userId: linha.user.id,
      handle: linha.user.handle,
      displayName: linha.user.displayName,
      avatarUrl: linha.user.avatarUrl,
      // `ownerId` é a fonte da verdade do papel de dono, aqui como no
      // `AcessoService`: uma linha de membro divergente não pode rebaixá-lo.
      papel: linha.userId === agenda.ownerId ? 'OWNER' : linha.role,
      desde: linha.joinedAt.toISOString(),
    }));
  }

  async definirPapel(entrada: {
    readonly userId: string;
    readonly calendarId: string;
    readonly membroId: string;
    readonly papel: PapelAtribuivel;
  }): Promise<void> {
    const { agenda } = await this.acesso.abrir({
      calendarId: entrada.calendarId,
      userId: entrada.userId,
      acao: 'gerenciar-membros',
    });

    if (entrada.membroId === agenda.ownerId) {
      throw new BadRequestException(
        'O papel do dono não muda por aqui: transferir a posse é outra operação.',
      );
    }

    const { count } = await this.prisma.calendarMember.updateMany({
      where: { calendarId: agenda.id, userId: entrada.membroId },
      data: { role: paraRole(entrada.papel) },
    });

    exigirQueExistisse(count);
  }

  async removerMembro(entrada: {
    readonly userId: string;
    readonly calendarId: string;
    readonly membroId: string;
  }): Promise<void> {
    const { agenda } = await this.acesso.abrir({
      calendarId: entrada.calendarId,
      userId: entrada.userId,
      acao: 'gerenciar-membros',
    });

    if (entrada.membroId === agenda.ownerId) {
      throw new ConflictException(
        'O dono não pode ser removido da própria agenda.',
      );
    }

    await this.apagarMembro(agenda.id, entrada.membroId);
  }

  /**
   * Sair da agenda exige apenas vê-la.
   *
   * Separado de `removerMembro` de propósito: sair é direito de quem entrou, e
   * exigir `gerenciar-membros` prenderia um VIEWER numa agenda que ele não quer
   * mais — o papel mais restrito não pode ser também o mais preso.
   */
  async sair(userId: string, calendarId: string): Promise<void> {
    const { agenda } = await this.acesso.abrir({
      calendarId,
      userId,
      acao: 'ver',
    });

    if (agenda.ownerId === userId) {
      throw new ConflictException(
        'Você é o dono desta agenda. Transfira a posse ou exclua a agenda.',
      );
    }

    await this.apagarMembro(agenda.id, userId);
  }

  private async apagarMembro(
    calendarId: string,
    membroId: string,
  ): Promise<void> {
    const { count } = await this.prisma.calendarMember.deleteMany({
      where: { calendarId, userId: membroId },
    });

    exigirQueExistisse(count);
  }
}

function exigirQueExistisse(count: number): void {
  if (count === 0) {
    throw new NotFoundException('Essa pessoa não é membro desta agenda.');
  }
}

export function visivel({ agenda, papel }: AcessoAAgenda): AgendaVisivel {
  return {
    id: agenda.id,
    name: agenda.name,
    description: agenda.description,
    kind: agenda.kind,
    color: agenda.color,
    icon: agenda.icon,
    timeZone: agenda.timeZone,
    isDefault: agenda.isDefault,
    arquivada: agenda.archivedAt !== null,
    papel,
    ownerId: agenda.ownerId,
  };
}

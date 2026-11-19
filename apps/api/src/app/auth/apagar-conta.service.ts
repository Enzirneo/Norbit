/**
 * Apagar a conta.
 *
 * A linha do usuário **fica**, anonimizada: eventos e tarefas criados em
 * agendas de outras pessoas apontam para ela, e apagá-la levaria o histórico
 * dessas pessoas junto (ou barraria a exclusão). O que identifica a pessoa
 * vai embora; o que ela escreveu em agenda alheia continua, atribuído a
 * "Conta excluída".
 */
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '@norbit/db';
import { SenhasService } from './senhas.service';

const SENHA_INCORRETA = 'A senha está incorreta.';

const NOME_DA_CONTA_EXCLUIDA = 'Conta excluída';

/** Domínio reservado (RFC 2606): o e-mail anonimizado nunca recebe nada. */
const DOMINIO_ANONIMO = 'excluido.norbit.invalid';

@Injectable()
export class ApagarContaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly senhas: SenhasService,
  ) {}

  /**
   * Barra se a pessoa é dona de agenda compartilhada com outros membros: apagar
   * a conta decidiria sozinha o destino da agenda dos outros. Ela passa a
   * posse ou exclui a agenda antes. As demais agendas dela são excluídas.
   *
   * A agenda padrão não entra na regra: não se transfere, e é a pessoal de quem
   * está saindo.
   */
  async apagar(entrada: {
    readonly userId: string;
    readonly senha: string;
  }): Promise<void> {
    const usuario = await this.prisma.user.findFirst({
      where: { id: entrada.userId, deletedAt: null },
    });
    if (
      !usuario?.passwordHash ||
      !(await this.senhas.conferir(usuario.passwordHash, entrada.senha))
    ) {
      throw new BadRequestException(SENHA_INCORRETA);
    }

    await this.exigirSemAgendaCompartilhada(usuario.id);
    await this.encerrar(usuario);
  }

  /**
   * Tudo numa transação: ou a conta some por inteiro, ou nada muda. Uma conta
   * meio apagada (sem sessões, mas ainda com o e-mail) seria pior que as duas.
   */
  private async encerrar(usuario: {
    readonly id: string;
    readonly email: string;
  }): Promise<void> {
    const agora = new Date();
    const id = usuario.id;

    await this.prisma.$transaction([
      this.prisma.calendar.updateMany({
        where: { ownerId: id, deletedAt: null },
        data: { deletedAt: agora },
      }),
      this.prisma.calendarMember.deleteMany({ where: { userId: id } }),
      this.prisma.calendarInvite.updateMany({
        where: {
          status: 'PENDING',
          OR: [{ invitedById: id }, { email: usuario.email }],
        },
        data: { status: 'REVOKED' },
      }),
      this.prisma.task.updateMany({
        where: { assigneeId: id },
        data: { assigneeId: null },
      }),
      this.prisma.eventParticipant.deleteMany({ where: { userId: id } }),
      this.prisma.reminder.deleteMany({ where: { userId: id } }),
      this.prisma.notification.deleteMany({ where: { userId: id } }),
      this.prisma.pushSubscription.deleteMany({ where: { userId: id } }),
      this.prisma.oAuthAccount.deleteMany({ where: { userId: id } }),
      this.prisma.passwordReset.deleteMany({ where: { userId: id } }),
      this.prisma.userSettings.deleteMany({ where: { userId: id } }),
      this.prisma.session.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: agora },
      }),
      this.prisma.user.update({
        where: { id },
        data: {
          email: `excluida-${id}@${DOMINIO_ANONIMO}`,
          handle: `excluida-${id.replaceAll('-', '').slice(-12)}`,
          displayName: NOME_DA_CONTA_EXCLUIDA,
          avatarUrl: null,
          profileColor: null,
          passwordHash: null,
          deletedAt: agora,
        },
      }),
    ]);
  }

  private async exigirSemAgendaCompartilhada(userId: string): Promise<void> {
    const agendas = await this.prisma.calendar.findMany({
      where: {
        ownerId: userId,
        deletedAt: null,
        isDefault: false,
        members: { some: { userId: { not: userId } } },
      },
      select: { name: true },
      orderBy: { name: 'asc' },
    });

    if (agendas.length > 0) {
      const nomes = agendas.map((a) => `"${a.name}"`).join(', ');
      throw new ConflictException(
        `Você é dono de agenda compartilhada com outras pessoas: ${nomes}. Passe a posse ou exclua a agenda antes de apagar a conta.`,
      );
    }
  }
}

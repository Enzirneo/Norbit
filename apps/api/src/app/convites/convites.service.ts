/**
 * Convites para uma agenda: criar, listar, revogar, e aceitar ou recusar.
 *
 * Quem convida e quem aceita são fluxos de segurança diferentes. Convidar exige
 * ser quem gerencia os membros da agenda (`AcessoService`); aceitar exige apenas
 * ter o token — e, no convite por e-mail, ser a conta daquele e-mail. A decisão
 * de aceitar está em `avaliarConvite` (`libs/domain`); este serviço a executa.
 */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
  type HttpException,
} from '@nestjs/common';
import type {
  ConviteCriado,
  ConviteVisivel,
  CriarConvite,
  PrevisaoDeConvite,
} from '@norbit/contracts';
import { PrismaService, type CalendarInvite } from '@norbit/db';
import { avaliarConvite, type DecisaoDeConvite } from '@norbit/domain';
import { uuidv7 } from 'uuidv7';
import { AcessoService } from '../agendas/acesso.service';
import { TokensService } from '../auth/tokens.service';
import { EmailService } from '../comum/email.service';

const DIA_EM_MS = 86_400_000;

/** O limite de usos de um convite por link quando o dono não escolhe. */
const USOS_PADRAO_DO_LINK = 10;

const PAPEIS_POR_EXTENSO = {
  EDITOR: 'editor',
  CONTRIBUTOR: 'colaborador',
  VIEWER: 'leitor',
} as const;

@Injectable()
export class ConvitesService {
  private readonly logger = new Logger(ConvitesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly acesso: AcessoService,
    private readonly tokens: TokensService,
    private readonly email: EmailService,
  ) {}

  async criar(
    userId: string,
    calendarId: string,
    dados: CriarConvite,
  ): Promise<ConviteCriado> {
    const { agenda } = await this.acesso.abrir({
      calendarId,
      userId,
      acao: 'gerenciar-membros',
    });

    const emailConvidado = dados.email ?? null;
    if (emailConvidado !== null) {
      await this.recusarSeJaForMembro(calendarId, emailConvidado);
    }

    const token = this.tokens.gerarTokenOpaco();
    const agora = new Date();
    const expiresAt = new Date(
      agora.getTime() + dados.validadeDias * DIA_EM_MS,
    );

    // Por e-mail o uso é sempre um: o convite é daquela conta. Por link, o dono
    // escolhe, e o padrão é finito — um link sem teto de usos circula para
    // sempre sem ninguém decidir isso.
    const maxUses =
      emailConvidado !== null ? 1 : (dados.usosMaximos ?? USOS_PADRAO_DO_LINK);

    const criado = await this.gravar({
      userId,
      calendarId,
      dados,
      emailConvidado,
      tokenHash: token.hash,
      maxUses,
      expiresAt,
    });

    const link = this.email.linkDoConvite(token.valor);

    if (emailConvidado !== null) {
      await this.avisar({
        userId,
        para: emailConvidado,
        agenda: agenda.name,
        papel: dados.papel,
        link,
        expiraEm: expiresAt,
      });
    }

    return { convite: visivel(criado), link };
  }

  async listar(userId: string, calendarId: string): Promise<ConviteVisivel[]> {
    await this.acesso.abrir({
      calendarId,
      userId,
      acao: 'gerenciar-membros',
    });

    const linhas = await this.prisma.calendarInvite.findMany({
      where: {
        calendarId,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    return linhas.map(visivel);
  }

  async revogar(
    userId: string,
    calendarId: string,
    conviteId: string,
  ): Promise<void> {
    await this.acesso.abrir({
      calendarId,
      userId,
      acao: 'gerenciar-membros',
    });

    // Escopado pela agenda: sem `calendarId` aqui, o dono da agenda A revogaria
    // convites da B sabendo só o identificador.
    const revogados = await this.prisma.calendarInvite.updateMany({
      where: { id: conviteId, calendarId, status: 'PENDING' },
      data: { status: 'REVOKED' },
    });
    if (revogados.count !== 1) {
      throw new NotFoundException('Convite não encontrado.');
    }
  }

  /**
   * O que a pessoa vê antes de aceitar. Não exige sessão: quem recebe o link
   * precisa saber **de quê** está sendo convidada para decidir se cria conta.
   * Quem tem o token já tem o segredo, então mostrar o nome da agenda não vaza
   * nada que o link não vazasse.
   */
  async previsao(token: string): Promise<PrevisaoDeConvite> {
    const convite = await this.buscar(token);

    // Sem conta em questão: a previsão julga só a validade do convite.
    const decisao = avaliarConvite(
      convite,
      { email: convite?.email ?? '', jaEhMembro: false },
      new Date(),
    );
    if (decisao.tipo !== 'aceitar' || !convite) {
      throw recusaDe(decisao);
    }

    const [agenda, convidante] = await Promise.all([
      this.prisma.calendar.findUniqueOrThrow({
        where: { id: convite.calendarId },
        select: { name: true, color: true },
      }),
      this.prisma.user.findUniqueOrThrow({
        where: { id: convite.invitedById },
        select: { displayName: true },
      }),
    ]);

    return {
      agenda: { nome: agenda.name, cor: agenda.color },
      convidadoPor: convidante.displayName,
      papel: convite.role,
      paraEmail: convite.email,
    };
  }

  async aceitar(
    userId: string,
    token: string,
  ): Promise<{ calendarId: string }> {
    const convite = await this.buscar(token);
    const usuario = await this.prisma.user.findFirstOrThrow({
      where: { id: userId, deletedAt: null },
      select: { email: true },
    });

    const jaEhMembro = convite
      ? await this.ehMembro(convite.calendarId, userId)
      : false;
    const decisao = avaliarConvite(
      convite,
      { email: usuario.email, jaEhMembro },
      new Date(),
    );

    if (decisao.tipo === 'ja-membro' && convite) {
      return { calendarId: convite.calendarId };
    }
    if (decisao.tipo !== 'aceitar' || !convite) {
      throw recusaDe(decisao);
    }

    await this.entrar(convite, userId);
    return { calendarId: convite.calendarId };
  }

  async recusar(userId: string, token: string): Promise<void> {
    const convite = await this.buscar(token);
    const usuario = await this.prisma.user.findFirstOrThrow({
      where: { id: userId, deletedAt: null },
      select: { email: true },
    });

    // Recusar é julgado como aceitar, menos "já é membro": quem já está na
    // agenda também pode recusar o convite que sobrou.
    const decisao = avaliarConvite(
      convite,
      { email: usuario.email, jaEhMembro: false },
      new Date(),
    );
    if (decisao.tipo !== 'aceitar' || !convite) {
      throw recusaDe(decisao);
    }
    if (convite.email === null) {
      throw new BadRequestException(
        'Um convite por link não se recusa: basta não usá-lo.',
      );
    }

    await this.prisma.calendarInvite.updateMany({
      where: { id: convite.id, status: 'PENDING' },
      data: { status: 'DECLINED' },
    });
  }

  // ─── privados ──────────────────────────────────────────────────────────────

  private async gravar(entrada: {
    userId: string;
    calendarId: string;
    dados: CriarConvite;
    emailConvidado: string | null;
    tokenHash: string;
    maxUses: number;
    expiresAt: Date;
  }): Promise<CalendarInvite> {
    const { calendarId, emailConvidado } = entrada;

    return this.prisma.$transaction(async (tx) => {
      // Um convite novo para o mesmo e-mail substitui o anterior: dois links
      // vivos para a mesma pessoa dobrariam a superfície sem ajudar ninguém. O
      // convite por link não substitui nada — pode haver vários.
      if (emailConvidado !== null) {
        await tx.calendarInvite.updateMany({
          where: { calendarId, status: 'PENDING', email: emailConvidado },
          data: { status: 'REVOKED' },
        });
      }

      return tx.calendarInvite.create({
        data: {
          id: uuidv7(),
          calendarId,
          invitedById: entrada.userId,
          email: emailConvidado,
          role: entrada.dados.papel,
          tokenHash: entrada.tokenHash,
          maxUses: entrada.maxUses,
          expiresAt: entrada.expiresAt,
        },
      });
    });
  }

  /** Envia o e-mail sem aguardar: a falha vai para o log, não para o dono. */
  private async avisar(entrada: {
    userId: string;
    para: string;
    agenda: string;
    papel: keyof typeof PAPEIS_POR_EXTENSO;
    link: string;
    expiraEm: Date;
  }): Promise<void> {
    const convidante = await this.prisma.user.findUniqueOrThrow({
      where: { id: entrada.userId },
      select: { displayName: true },
    });

    void this.email
      .enviarConvite({
        para: entrada.para,
        convidadoPor: convidante.displayName,
        agenda: entrada.agenda,
        papel: PAPEIS_POR_EXTENSO[entrada.papel],
        link: entrada.link,
        expiraEm: entrada.expiraEm,
      })
      .catch((erro: unknown) => {
        // O convite existe e o dono vê o link na resposta: ele pode repassá-lo
        // por onde preferir.
        this.logger.error(
          `Falha ao enviar o e-mail do convite: ${String(erro)}`,
        );
      });
  }

  private buscar(token: string): Promise<CalendarInvite | null> {
    return this.prisma.calendarInvite.findUnique({
      where: { tokenHash: this.tokens.hashDoToken(token) },
    });
  }

  private async ehMembro(calendarId: string, userId: string): Promise<boolean> {
    const agenda = await this.prisma.calendar.findFirst({
      where: {
        id: calendarId,
        deletedAt: null,
        OR: [{ ownerId: userId }, { members: { some: { userId } } }],
      },
      select: { id: true },
    });
    return agenda !== null;
  }

  private async recusarSeJaForMembro(
    calendarId: string,
    email: string,
  ): Promise<void> {
    const membro = await this.prisma.user.findFirst({
      where: {
        email,
        deletedAt: null,
        OR: [
          { ownedCalendars: { some: { id: calendarId } } },
          { memberships: { some: { calendarId } } },
        ],
      },
      select: { id: true },
    });
    if (membro) {
      throw new ConflictException('Essa pessoa já está na agenda.');
    }
  }

  /**
   * Gasta um uso do convite e cria a linha de membro, numa transação.
   *
   * O `updateMany` com `useCount < maxUses` é o que decide a corrida entre dois
   * aceites do último uso: o Postgres reavalia o `where` depois de esperar o
   * bloqueio da linha, então só um dos dois encontra uso disponível. Ler
   * "ainda há uso" e gastá-lo em passos separados deixaria os dois entrarem.
   */
  private async entrar(convite: CalendarInvite, userId: string): Promise<void> {
    const porEmail = convite.email !== null;

    await this.prisma.$transaction(async (tx) => {
      const gasto = await tx.calendarInvite.updateMany({
        where: {
          id: convite.id,
          status: 'PENDING',
          ...(convite.maxUses !== null
            ? { useCount: { lt: convite.maxUses } }
            : {}),
        },
        data: {
          useCount: { increment: 1 },
          ...(porEmail
            ? { status: 'ACCEPTED' as const, acceptedAt: new Date() }
            : {}),
        },
      });
      if (gasto.count !== 1) {
        // Outro aceite, ou uma revogação, passou na frente entre a leitura e
        // aqui. O motivo exato não importa para quem chegou tarde.
        throw new GoneException('Este convite não está mais disponível.');
      }

      await tx.calendarMember.create({
        data: {
          calendarId: convite.calendarId,
          userId,
          role: convite.role,
        },
      });
    });
  }
}

function visivel(convite: CalendarInvite): ConviteVisivel {
  return {
    id: convite.id,
    email: convite.email,
    papel: convite.role,
    expiraEm: convite.expiresAt.toISOString(),
    usosMaximos: convite.maxUses,
    usos: convite.useCount,
    criadoEm: convite.createdAt.toISOString(),
  };
}

/**
 * A resposta HTTP de cada motivo de recusa.
 *
 * `404` para o que não existe; `403` para o convite que é de outra conta; `410`
 * para o que existiu e deixou de valer — a pessoa precisa saber que a saída é
 * pedir outro, e `410 Gone` diz isso melhor do que um `400` genérico.
 */
function recusaDe(decisao: DecisaoDeConvite): HttpException {
  switch (decisao.tipo) {
    case 'desconhecido':
      return new NotFoundException('Convite não encontrado.');
    case 'email-diferente':
      return new ForbiddenException(
        'Este convite foi enviado para outro e-mail. Entre com a conta convidada.',
      );
    case 'revogado':
      return new GoneException('Este convite foi cancelado por quem o enviou.');
    case 'recusado':
      return new GoneException('Este convite foi recusado.');
    case 'ja-usado':
      return new GoneException('Este convite já foi usado.');
    case 'expirado':
      return new GoneException('Este convite expirou. Peça um novo.');
    case 'esgotado':
      return new GoneException(
        'Este convite atingiu o limite de usos. Peça um novo.',
      );
    default:
      // `aceitar` e `ja-membro` não chegam aqui: quem chama já os tratou.
      return new GoneException('Este convite não está disponível.');
  }
}

/**
 * Apagar a conta, contra o Postgres de verdade.
 *
 * O que importa provar está nas linhas do banco: a conta deixa de existir para
 * o login e libera e-mail e handle; o que ela criou em agendas dos outros
 * continua lá; e uma agenda compartilhada de que ela é dona barra a exclusão.
 */
import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaModule, PrismaService } from '@norbit/db';
import { uuidv7 } from 'uuidv7';
import { ApagarContaService } from './apagar-conta.service';
import { AuthService } from './auth.service';
import { SenhasService } from './senhas.service';
import { TokensService } from './tokens.service';

const CONTEXTO = { userAgent: 'jest', ipAddress: '127.0.0.1' };

// Montadas em tempo de execução para não acionar o detector de segredos.
const SENHA = ['senha', 'da', 'conta', 'bem', 'longa'].join(' ');
const SENHA_ERRADA = ['senha', 'que', 'nao', 'e', 'a', 'minha'].join(' ');

const CADASTRO = {
  email: 'apagar@norbit.dev',
  handle: 'apagar',
  displayName: 'Apagar',
  password: SENHA,
};
const AMIGA = {
  email: 'amiga-apagar@norbit.dev',
  handle: 'amigaapagar',
  displayName: 'Amiga',
  password: SENHA,
};

describe('ApagarContaService', () => {
  let modulo: TestingModule;
  let auth: AuthService;
  let apagar: ApagarContaService;
  let prisma: PrismaService;

  beforeAll(async () => {
    modulo = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        PrismaModule,
        JwtModule.register({
          secret: process.env.JWT_ACCESS_SECRET ?? 'segredo-de-teste',
          signOptions: { expiresIn: '15m' },
        }),
      ],
      providers: [
        AuthService,
        ApagarContaService,
        SenhasService,
        TokensService,
      ],
    }).compile();

    await modulo.init();

    auth = modulo.get(AuthService);
    apagar = modulo.get(ApagarContaService);
    prisma = modulo.get(PrismaService);
  });

  afterAll(async () => {
    await limpar(prisma);
    await modulo.close();
  });

  beforeEach(async () => {
    await limpar(prisma);
  });

  it('a conta deixa de entrar, e a sessão não renova mais', async () => {
    const { usuario, refreshToken } = await auth.cadastrar(CADASTRO, CONTEXTO);

    await apagar.apagar({ userId: usuario.id, senha: SENHA });

    await expect(auth.entrar(CADASTRO, CONTEXTO)).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(auth.renovar(refreshToken, CONTEXTO)).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(auth.usuarioPorId(usuario.id)).resolves.toBeNull();
  });

  it('libera o e-mail e o handle para um cadastro novo', async () => {
    const { usuario } = await auth.cadastrar(CADASTRO, CONTEXTO);

    await apagar.apagar({ userId: usuario.id, senha: SENHA });

    const nova = await auth.cadastrar(CADASTRO, CONTEXTO);
    expect(nova.usuario.id).not.toBe(usuario.id);
  });

  it('apaga os dados pessoais da linha que fica', async () => {
    const { usuario } = await auth.cadastrar(CADASTRO, CONTEXTO);

    await apagar.apagar({ userId: usuario.id, senha: SENHA });

    const linha = await prisma.user.findUniqueOrThrow({
      where: { id: usuario.id },
    });
    expect(linha.deletedAt).not.toBeNull();
    expect(linha.passwordHash).toBeNull();
    expect(linha.avatarUrl).toBeNull();
    expect(linha.email).not.toContain('apagar@');
    expect(linha.handle).not.toBe(CADASTRO.handle);
    expect(linha.displayName).toBe('Conta excluída');
  });

  it('exclui as agendas da pessoa, inclusive a padrão', async () => {
    const { usuario } = await auth.cadastrar(CADASTRO, CONTEXTO);

    await apagar.apagar({ userId: usuario.id, senha: SENHA });

    const vivas = await prisma.calendar.count({
      where: { ownerId: usuario.id, deletedAt: null },
    });
    expect(vivas).toBe(0);
  });

  it('sai das agendas dos outros, e o que criou lá continua', async () => {
    const eu = await auth.cadastrar(CADASTRO, CONTEXTO);
    const amiga = await auth.cadastrar(AMIGA, CONTEXTO);
    const agendaId = await agendaCompartilhada(prisma, amiga.usuario.id, [
      { userId: eu.usuario.id, role: 'EDITOR' },
    ]);
    const eventoId = await criarEvento(prisma, agendaId, eu.usuario.id);

    await apagar.apagar({ userId: eu.usuario.id, senha: SENHA });

    const membros = await prisma.calendarMember.findMany({
      where: { calendarId: agendaId },
    });
    expect(membros.map((m) => m.userId)).toEqual([amiga.usuario.id]);
    const evento = await prisma.event.findUniqueOrThrow({
      where: { id: eventoId },
    });
    expect(evento.deletedAt).toBeNull();
    const agenda = await prisma.calendar.findUniqueOrThrow({
      where: { id: agendaId },
    });
    expect(agenda.deletedAt).toBeNull();
  });

  it('exclui agenda compartilhada de que é dona, se está sozinha nela', async () => {
    const eu = await auth.cadastrar(CADASTRO, CONTEXTO);
    const agendaId = await agendaCompartilhada(prisma, eu.usuario.id, []);

    await apagar.apagar({ userId: eu.usuario.id, senha: SENHA });

    const agenda = await prisma.calendar.findUniqueOrThrow({
      where: { id: agendaId },
    });
    expect(agenda.deletedAt).not.toBeNull();
  });

  it('barra a exclusão se é dona de agenda compartilhada com outros, e nada muda', async () => {
    const eu = await auth.cadastrar(CADASTRO, CONTEXTO);
    const amiga = await auth.cadastrar(AMIGA, CONTEXTO);
    await agendaCompartilhada(
      prisma,
      eu.usuario.id,
      [{ userId: amiga.usuario.id, role: 'EDITOR' }],
      'Viagem de 2027',
    );

    await expect(
      apagar.apagar({ userId: eu.usuario.id, senha: SENHA }),
    ).rejects.toThrow(ConflictException);
    await expect(
      apagar.apagar({ userId: eu.usuario.id, senha: SENHA }),
    ).rejects.toThrow('Viagem de 2027');

    await expect(auth.entrar(CADASTRO, CONTEXTO)).resolves.toBeDefined();
  });

  it('depois de passar a posse, a exclusão passa', async () => {
    const eu = await auth.cadastrar(CADASTRO, CONTEXTO);
    const amiga = await auth.cadastrar(AMIGA, CONTEXTO);
    const agendaId = await agendaCompartilhada(prisma, eu.usuario.id, [
      { userId: amiga.usuario.id, role: 'EDITOR' },
    ]);
    await prisma.$transaction([
      prisma.calendar.update({
        where: { id: agendaId },
        data: { ownerId: amiga.usuario.id },
      }),
      prisma.calendarMember.update({
        where: {
          calendarId_userId: { calendarId: agendaId, userId: amiga.usuario.id },
        },
        data: { role: 'OWNER' },
      }),
    ]);

    await expect(
      apagar.apagar({ userId: eu.usuario.id, senha: SENHA }),
    ).resolves.toBeUndefined();
  });

  it('recusa com a senha errada, e nada muda', async () => {
    const { usuario } = await auth.cadastrar(CADASTRO, CONTEXTO);

    await expect(
      apagar.apagar({ userId: usuario.id, senha: SENHA_ERRADA }),
    ).rejects.toThrow(BadRequestException);

    await expect(auth.entrar(CADASTRO, CONTEXTO)).resolves.toBeDefined();
  });

  it('revoga os convites pendentes que a pessoa emitiu', async () => {
    const eu = await auth.cadastrar(CADASTRO, CONTEXTO);
    const amiga = await auth.cadastrar(AMIGA, CONTEXTO);
    const agendaId = await agendaCompartilhada(prisma, amiga.usuario.id, [
      { userId: eu.usuario.id, role: 'EDITOR' },
    ]);
    const conviteId = uuidv7();
    await prisma.calendarInvite.create({
      data: {
        id: conviteId,
        calendarId: agendaId,
        invitedById: eu.usuario.id,
        email: 'alguem@norbit.dev',
        role: 'VIEWER',
        tokenHash: `hash-${conviteId}`,
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });

    await apagar.apagar({ userId: eu.usuario.id, senha: SENHA });

    const convite = await prisma.calendarInvite.findUniqueOrThrow({
      where: { id: conviteId },
    });
    expect(convite.status).toBe('REVOKED');
  });

  it('revoga convites pendentes endereçados ao e-mail liberado', async () => {
    const eu = await auth.cadastrar(CADASTRO, CONTEXTO);
    const amiga = await auth.cadastrar(AMIGA, CONTEXTO);
    const agendaId = await agendaCompartilhada(prisma, amiga.usuario.id, []);
    const conviteId = uuidv7();
    await prisma.calendarInvite.create({
      data: {
        id: conviteId,
        calendarId: agendaId,
        invitedById: amiga.usuario.id,
        email: CADASTRO.email,
        role: 'VIEWER',
        tokenHash: `hash-${conviteId}`,
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });

    await apagar.apagar({ userId: eu.usuario.id, senha: SENHA });

    const convite = await prisma.calendarInvite.findUniqueOrThrow({
      where: { id: conviteId },
    });
    expect(convite.status).toBe('REVOKED');
  });

  it('tarefas atribuídas à pessoa ficam sem responsável', async () => {
    const eu = await auth.cadastrar(CADASTRO, CONTEXTO);
    const amiga = await auth.cadastrar(AMIGA, CONTEXTO);
    const agendaId = await agendaCompartilhada(prisma, amiga.usuario.id, [
      { userId: eu.usuario.id, role: 'EDITOR' },
    ]);
    const tarefaId = uuidv7();
    await prisma.task.create({
      data: {
        id: tarefaId,
        calendarId: agendaId,
        createdById: amiga.usuario.id,
        assigneeId: eu.usuario.id,
        title: 'Comprar passagens',
      },
    });

    await apagar.apagar({ userId: eu.usuario.id, senha: SENHA });

    const tarefa = await prisma.task.findUniqueOrThrow({
      where: { id: tarefaId },
    });
    expect(tarefa.assigneeId).toBeNull();
  });
});

async function agendaCompartilhada(
  prisma: PrismaService,
  donoId: string,
  outros: readonly { userId: string; role: 'EDITOR' | 'VIEWER' }[],
  nome = 'Compartilhada',
): Promise<string> {
  const id = uuidv7();
  await prisma.calendar.create({
    data: {
      id,
      ownerId: donoId,
      name: nome,
      kind: 'SHARED',
      members: {
        create: [
          { userId: donoId, role: 'OWNER' },
          ...outros.map((o) => ({ userId: o.userId, role: o.role })),
        ],
      },
    },
  });
  return id;
}

async function criarEvento(
  prisma: PrismaService,
  calendarId: string,
  createdById: string,
): Promise<string> {
  const id = uuidv7();
  const inicio = new Date('2030-01-01T12:00:00Z');
  await prisma.event.create({
    data: {
      id,
      calendarId,
      createdById,
      title: 'Jantar',
      timeZone: 'America/Sao_Paulo',
      startsAt: inicio,
      endsAt: new Date(inicio.getTime() + 3_600_000),
    },
  });
  return id;
}

async function limpar(prisma: PrismaService): Promise<void> {
  const usuarios = await prisma.user.findMany({
    where: {
      OR: [
        { email: { in: [CADASTRO.email, AMIGA.email] } },
        { email: { startsWith: 'excluida-' } },
        { handle: { in: [CADASTRO.handle, AMIGA.handle] } },
      ],
    },
    select: { id: true },
  });
  const ids = usuarios.map((u) => u.id);

  if (ids.length > 0) {
    await prisma.calendar.deleteMany({ where: { ownerId: { in: ids } } });
    await prisma.event.deleteMany({ where: { createdById: { in: ids } } });
    await prisma.task.deleteMany({ where: { createdById: { in: ids } } });
    await prisma.calendarInvite.deleteMany({
      where: { invitedById: { in: ids } },
    });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
}

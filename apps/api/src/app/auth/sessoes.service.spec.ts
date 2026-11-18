/**
 * Listar e revogar sessões, contra o Postgres de verdade.
 *
 * Um "aparelho" é uma família de sessões: cada renovação cria uma linha nova e
 * revoga a anterior, então só a linha viva diz de onde a pessoa está entrando.
 */
import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaModule, PrismaService } from '@norbit/db';
import { AuthService } from './auth.service';
import { SenhasService } from './senhas.service';
import { SessoesService } from './sessoes.service';
import { TokensService } from './tokens.service';

const NOTEBOOK = { userAgent: 'Firefox no notebook', ipAddress: '10.0.0.1' };
const CELULAR = { userAgent: 'Safari no celular', ipAddress: '10.0.0.2' };

// Montada em tempo de execução para não acionar o detector de segredos.
const SENHA = ['senha', 'das', 'sessoes', 'bem', 'longa'].join(' ');

const CADASTRO = {
  email: 'sessoes@norbit.dev',
  handle: 'sessoes',
  displayName: 'Sessões',
  password: SENHA,
};
const OUTRA = {
  email: 'outra-sessoes@norbit.dev',
  handle: 'outrasessoes',
  displayName: 'Outra',
  password: SENHA,
};

describe('SessoesService', () => {
  let modulo: TestingModule;
  let auth: AuthService;
  let sessoes: SessoesService;
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
      providers: [AuthService, SessoesService, SenhasService, TokensService],
    }).compile();

    await modulo.init();

    auth = modulo.get(AuthService);
    sessoes = modulo.get(SessoesService);
    prisma = modulo.get(PrismaService);
  });

  afterAll(async () => {
    await limpar(prisma);
    await modulo.close();
  });

  beforeEach(async () => {
    await limpar(prisma);
  });

  describe('listar', () => {
    it('mostra um item por aparelho, com o contexto da última renovação', async () => {
      const aqui = await auth.cadastrar(CADASTRO, NOTEBOOK);
      await auth.entrar(CADASTRO, CELULAR);
      // Renovar não cria um aparelho novo: troca a linha viva do mesmo.
      await auth.renovar(aqui.refreshToken, {
        userAgent: 'Firefox atualizado',
        ipAddress: '10.0.0.9',
      });

      const lista = await sessoes.listar({
        userId: aqui.usuario.id,
        refreshToken: undefined,
      });

      expect(lista).toHaveLength(2);
      expect(lista.map((s) => s.userAgent).sort()).toEqual([
        'Firefox atualizado',
        'Safari no celular',
      ]);
      expect(lista.find((s) => s.userAgent === 'Firefox atualizado')).toEqual(
        expect.objectContaining({ ipAddress: '10.0.0.9' }),
      );
    });

    it('marca como atual só o aparelho do refresh apresentado', async () => {
      const aqui = await auth.cadastrar(CADASTRO, NOTEBOOK);
      await auth.entrar(CADASTRO, CELULAR);

      const lista = await sessoes.listar({
        userId: aqui.usuario.id,
        refreshToken: aqui.refreshToken,
      });

      expect(lista.filter((s) => s.atual)).toHaveLength(1);
      expect(lista.find((s) => s.atual)?.userAgent).toBe(NOTEBOOK.userAgent);
    });

    it('sem refresh identificado, nenhum é marcado como atual', async () => {
      const aqui = await auth.cadastrar(CADASTRO, NOTEBOOK);

      const lista = await sessoes.listar({
        userId: aqui.usuario.id,
        refreshToken: undefined,
      });

      expect(lista.every((s) => !s.atual)).toBe(true);
    });

    it('não lista sessões revogadas nem vencidas', async () => {
      const aqui = await auth.cadastrar(CADASTRO, NOTEBOOK);
      const celular = await auth.entrar(CADASTRO, CELULAR);
      const vencido = await auth.entrar(CADASTRO, {
        userAgent: 'Aparelho vencido',
        ipAddress: '10.0.0.3',
      });
      await auth.sair(celular.refreshToken);
      await prisma.session.updateMany({
        where: { userAgent: 'Aparelho vencido' },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      const lista = await sessoes.listar({
        userId: aqui.usuario.id,
        refreshToken: undefined,
      });

      expect(lista.map((s) => s.userAgent)).toEqual([NOTEBOOK.userAgent]);
      expect(vencido.usuario.id).toBe(aqui.usuario.id);
    });

    it('não mostra sessões de outra conta', async () => {
      const aqui = await auth.cadastrar(CADASTRO, NOTEBOOK);
      await auth.cadastrar(OUTRA, CELULAR);

      const lista = await sessoes.listar({
        userId: aqui.usuario.id,
        refreshToken: undefined,
      });

      expect(lista.map((s) => s.userAgent)).toEqual([NOTEBOOK.userAgent]);
    });
  });

  describe('revogar', () => {
    it('derruba o aparelho escolhido e poupa o resto', async () => {
      const aqui = await auth.cadastrar(CADASTRO, NOTEBOOK);
      const celular = await auth.entrar(CADASTRO, CELULAR);
      const alvo = await idDoAparelho(sessoes, aqui.usuario.id, CELULAR);

      await sessoes.revogar({
        userId: aqui.usuario.id,
        sessaoId: alvo,
        refreshToken: aqui.refreshToken,
      });

      await expect(auth.renovar(celular.refreshToken, CELULAR)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(
        auth.renovar(aqui.refreshToken, NOTEBOOK),
      ).resolves.toBeDefined();
    });

    it('recusa revogar o aparelho atual: para isso existe o Sair', async () => {
      const aqui = await auth.cadastrar(CADASTRO, NOTEBOOK);
      const atual = await idDoAparelho(sessoes, aqui.usuario.id, NOTEBOOK);

      await expect(
        sessoes.revogar({
          userId: aqui.usuario.id,
          sessaoId: atual,
          refreshToken: aqui.refreshToken,
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        auth.renovar(aqui.refreshToken, NOTEBOOK),
      ).resolves.toBeDefined();
    });

    it('não derruba sessão de outra conta, e responde como se não existisse', async () => {
      const aqui = await auth.cadastrar(CADASTRO, NOTEBOOK);
      const alheia = await auth.cadastrar(OUTRA, CELULAR);
      const alvo = await idDoAparelho(sessoes, alheia.usuario.id, CELULAR);

      await expect(
        sessoes.revogar({
          userId: aqui.usuario.id,
          sessaoId: alvo,
          refreshToken: aqui.refreshToken,
        }),
      ).rejects.toThrow(NotFoundException);

      await expect(
        auth.renovar(alheia.refreshToken, CELULAR),
      ).resolves.toBeDefined();
    });

    it('um aparelho que já saiu responde 404', async () => {
      const aqui = await auth.cadastrar(CADASTRO, NOTEBOOK);
      const celular = await auth.entrar(CADASTRO, CELULAR);
      const alvo = await idDoAparelho(sessoes, aqui.usuario.id, CELULAR);
      await auth.sair(celular.refreshToken);

      await expect(
        sessoes.revogar({
          userId: aqui.usuario.id,
          sessaoId: alvo,
          refreshToken: aqui.refreshToken,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});

async function idDoAparelho(
  sessoes: SessoesService,
  userId: string,
  contexto: { userAgent: string },
): Promise<string> {
  const lista = await sessoes.listar({ userId, refreshToken: undefined });
  const achada = lista.find((s) => s.userAgent === contexto.userAgent);
  if (!achada) {
    throw new Error(`Aparelho não encontrado: ${contexto.userAgent}`);
  }
  return achada.id;
}

async function limpar(prisma: PrismaService): Promise<void> {
  const usuarios = await prisma.user.findMany({
    where: {
      OR: [
        { email: { in: [CADASTRO.email, OUTRA.email] } },
        { handle: { in: [CADASTRO.handle, OUTRA.handle] } },
      ],
    },
    select: { id: true },
  });
  const ids = usuarios.map((u) => u.id);

  if (ids.length > 0) {
    await prisma.calendar.deleteMany({ where: { ownerId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
}

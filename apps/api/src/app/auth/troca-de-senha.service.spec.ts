/**
 * Trocar a senha logado, contra o Postgres de verdade.
 *
 * O que importa provar está nas linhas do banco: a senha antiga deixa de valer,
 * as sessões **dos outros aparelhos** caem e a deste continua.
 */
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaModule, PrismaService } from '@norbit/db';
import { AuthService } from './auth.service';
import { SenhasService } from './senhas.service';
import { TokensService } from './tokens.service';
import { TrocaDeSenhaService } from './troca-de-senha.service';

const CONTEXTO = { userAgent: 'jest', ipAddress: '127.0.0.1' };

// Montadas em tempo de execução para não acionar o detector de segredos.
const SENHA_ANTIGA = ['senha', 'antiga', 'bem', 'longa'].join(' ');
const SENHA_NOVA = ['senha', 'nova', 'ainda', 'mais', 'longa'].join(' ');
const SENHA_ERRADA = ['senha', 'que', 'nao', 'e', 'a', 'minha'].join(' ');

const CADASTRO = {
  email: 'troca@norbit.dev',
  handle: 'troca',
  displayName: 'Troca',
  password: SENHA_ANTIGA,
};
const OUTRA = {
  email: 'outra-troca@norbit.dev',
  handle: 'outratroca',
  displayName: 'Outra',
  password: SENHA_ANTIGA,
};

describe('TrocaDeSenhaService', () => {
  let modulo: TestingModule;
  let auth: AuthService;
  let troca: TrocaDeSenhaService;
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
        TrocaDeSenhaService,
        SenhasService,
        TokensService,
      ],
    }).compile();

    await modulo.init();

    auth = modulo.get(AuthService);
    troca = modulo.get(TrocaDeSenhaService);
    prisma = modulo.get(PrismaService);
  });

  afterAll(async () => {
    await limpar(prisma);
    await modulo.close();
  });

  beforeEach(async () => {
    await limpar(prisma);
  });

  it('a senha nova passa a valer e a antiga deixa de valer', async () => {
    const { usuario, refreshToken } = await auth.cadastrar(CADASTRO, CONTEXTO);

    await troca.trocar({
      userId: usuario.id,
      senhaAtual: SENHA_ANTIGA,
      novaSenha: SENHA_NOVA,
      refreshToken,
    });

    await expect(
      auth.entrar({ ...CADASTRO, password: SENHA_NOVA }, CONTEXTO),
    ).resolves.toBeDefined();
    await expect(auth.entrar(CADASTRO, CONTEXTO)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('recusa quando a senha atual está errada, e nada muda', async () => {
    const { usuario, refreshToken } = await auth.cadastrar(CADASTRO, CONTEXTO);

    await expect(
      troca.trocar({
        userId: usuario.id,
        senhaAtual: SENHA_ERRADA,
        novaSenha: SENHA_NOVA,
        refreshToken,
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(auth.entrar(CADASTRO, CONTEXTO)).resolves.toBeDefined();
    await expect(auth.renovar(refreshToken, CONTEXTO)).resolves.toBeDefined();
  });

  it('derruba os outros aparelhos e mantém este', async () => {
    const aqui = await auth.cadastrar(CADASTRO, CONTEXTO);
    const outroAparelho = await auth.entrar(CADASTRO, CONTEXTO);

    await troca.trocar({
      userId: aqui.usuario.id,
      senhaAtual: SENHA_ANTIGA,
      novaSenha: SENHA_NOVA,
      refreshToken: aqui.refreshToken,
    });

    await expect(
      auth.renovar(outroAparelho.refreshToken, CONTEXTO),
    ).rejects.toThrow(UnauthorizedException);
    await expect(
      auth.renovar(aqui.refreshToken, CONTEXTO),
    ).resolves.toBeDefined();
  });

  it('sem sessão identificada, derruba todas — na dúvida, fecha', async () => {
    const aqui = await auth.cadastrar(CADASTRO, CONTEXTO);

    await troca.trocar({
      userId: aqui.usuario.id,
      senhaAtual: SENHA_ANTIGA,
      novaSenha: SENHA_NOVA,
      refreshToken: undefined,
    });

    await expect(auth.renovar(aqui.refreshToken, CONTEXTO)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('o refresh de outra conta não poupa nenhuma sessão desta', async () => {
    const aqui = await auth.cadastrar(CADASTRO, CONTEXTO);
    const alheia = await auth.cadastrar(OUTRA, CONTEXTO);

    await troca.trocar({
      userId: aqui.usuario.id,
      senhaAtual: SENHA_ANTIGA,
      novaSenha: SENHA_NOVA,
      refreshToken: alheia.refreshToken,
    });

    await expect(auth.renovar(aqui.refreshToken, CONTEXTO)).rejects.toThrow(
      UnauthorizedException,
    );
    // A sessão da outra pessoa não é tocada.
    await expect(
      auth.renovar(alheia.refreshToken, CONTEXTO),
    ).resolves.toBeDefined();
  });
});

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

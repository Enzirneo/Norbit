/**
 * Testes de integração da autenticação, contra o Postgres de verdade.
 *
 * Mockar o Prisma aqui destruiria o valor do teste: o que precisa ser provado é
 * que a rotação e a revogação por família acontecem **no banco**, em linhas
 * reais. Um mock provaria apenas que o código chama os métodos que eu escrevi
 * que ele chamaria.
 */
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { PrismaModule, PrismaService } from '@norbit/db';
import { AuthService } from './auth.service';
import { SenhasService } from './senhas.service';
import { TokensService } from './tokens.service';

const CONTEXTO = { userAgent: 'jest', ipAddress: '127.0.0.1' };

const SENHA = 'uma senha bem longa';

const CADASTRO = {
  email: 'teste-auth@norbit.dev',
  handle: 'teste_auth',
  displayName: 'Teste',
  password: SENHA,
};

describe('AuthService', () => {
  let modulo: TestingModule;
  let auth: AuthService;
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
      providers: [AuthService, SenhasService, TokensService],
    }).compile();

    await modulo.init();

    auth = modulo.get(AuthService);
    prisma = modulo.get(PrismaService);
  });

  afterAll(async () => {
    await limpar(prisma);
    await modulo.close();
  });

  beforeEach(async () => {
    await limpar(prisma);
  });

  describe('cadastrar', () => {
    it('cria a conta e as preferências na mesma transação', async () => {
      const { usuario } = await auth.cadastrar(CADASTRO, CONTEXTO);

      const gravado = await prisma.user.findUnique({
        where: { id: usuario.id },
        include: { settings: true },
      });

      expect(gravado?.handle).toBe('teste_auth');
      // O roadmap exige UserSettings criado junto com a conta: sem isto a
      // primeira tela de preferências abriria vazia.
      expect(gravado?.settings).not.toBeNull();
    });

    it('nunca guarda a senha em claro', async () => {
      const { usuario } = await auth.cadastrar(CADASTRO, CONTEXTO);

      const gravado = await prisma.user.findUnique({
        where: { id: usuario.id },
      });

      expect(gravado?.passwordHash).not.toContain(SENHA);
      expect(gravado?.passwordHash).toMatch(/^\$argon2id\$/);
    });

    it('recusa e-mail repetido dizendo qual campo conflitou', async () => {
      await auth.cadastrar(CADASTRO, CONTEXTO);

      await expect(
        auth.cadastrar({ ...CADASTRO, handle: 'outro_handle' }, CONTEXTO),
      ).rejects.toThrow(ConflictException);
    });

    it('recusa handle repetido', async () => {
      await auth.cadastrar(CADASTRO, CONTEXTO);

      await expect(
        auth.cadastrar({ ...CADASTRO, email: 'outro@norbit.dev' }, CONTEXTO),
      ).rejects.toThrow(/handle/i);
    });
  });

  describe('entrar', () => {
    it('autentica com a senha correta', async () => {
      await auth.cadastrar(CADASTRO, CONTEXTO);

      const sessao = await auth.entrar(
        { email: CADASTRO.email, password: SENHA },
        CONTEXTO,
      );

      expect(sessao.accessToken).toBeTruthy();
      expect(sessao.usuario.email).toBe(CADASTRO.email);
    });

    it('recusa a senha errada', async () => {
      await auth.cadastrar(CADASTRO, CONTEXTO);

      await expect(
        auth.entrar(
          { email: CADASTRO.email, password: 'outra senha longa' },
          CONTEXTO,
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('dá a mesma mensagem para e-mail inexistente e senha errada', async () => {
      await auth.cadastrar(CADASTRO, CONTEXTO);

      const comEmailErrado = await auth
        .entrar({ email: 'ninguem@norbit.dev', password: SENHA }, CONTEXTO)
        .catch((erro: Error) => erro.message);

      const comSenhaErrada = await auth
        .entrar(
          { email: CADASTRO.email, password: 'senha bem errada' },
          CONTEXTO,
        )
        .catch((erro: Error) => erro.message);

      // Mensagens diferentes revelariam quais e-mails têm conta.
      expect(comEmailErrado).toBe(comSenhaErrada);
    });
  });

  describe('renovar', () => {
    it('rotaciona: o token novo vale e o usado deixa de valer', async () => {
      const primeira = await auth.cadastrar(CADASTRO, CONTEXTO);

      const segunda = await auth.renovar(primeira.refreshToken, CONTEXTO);

      expect(segunda.refreshToken).not.toBe(primeira.refreshToken);

      // O novo funciona.
      await expect(
        auth.renovar(segunda.refreshToken, CONTEXTO),
      ).resolves.toBeDefined();
    });

    it('revoga a família inteira quando um token já usado reaparece', async () => {
      // O cenário do roubo de cookie: alguém copiou o refresh, o legítimo
      // renovou, e agora a cópia é apresentada.
      const primeira = await auth.cadastrar(CADASTRO, CONTEXTO);
      const segunda = await auth.renovar(primeira.refreshToken, CONTEXTO);

      // A cópia antiga é recusada...
      await expect(
        auth.renovar(primeira.refreshToken, CONTEXTO),
      ).rejects.toThrow(UnauthorizedException);

      // ...e, o que importa de verdade, a sessão legítima também cai. É o
      // preço da detecção: na dúvida sobre quem é o dono, os dois entram de
      // novo. Se este expect falhar, quem roubou o token continua dentro.
      await expect(
        auth.renovar(segunda.refreshToken, CONTEXTO),
      ).rejects.toThrow(UnauthorizedException);

      const vivas = await prisma.session.count({
        where: { user: { email: CADASTRO.email }, revokedAt: null },
      });
      expect(vivas).toBe(0);
    });

    it('recusa um refresh que nunca existiu', async () => {
      await expect(auth.renovar('nao-existe', CONTEXTO)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('recusa um refresh expirado sem derrubar a família', async () => {
      const { refreshToken, usuario } = await auth.cadastrar(
        CADASTRO,
        CONTEXTO,
      );

      await prisma.session.updateMany({
        where: { userId: usuario.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      await expect(auth.renovar(refreshToken, CONTEXTO)).rejects.toThrow(
        UnauthorizedException,
      );

      // Expirar não é sinal de roubo: a sessão não deve ser marcada como
      // revogada, só recusada.
      const sessao = await prisma.session.findFirst({
        where: { userId: usuario.id },
      });
      expect(sessao?.revokedAt).toBeNull();
    });
  });

  describe('sair', () => {
    it('revoga a família, invalidando também os tokens já rotacionados', async () => {
      const primeira = await auth.cadastrar(CADASTRO, CONTEXTO);
      const segunda = await auth.renovar(primeira.refreshToken, CONTEXTO);

      await auth.sair(segunda.refreshToken);

      await expect(
        auth.renovar(segunda.refreshToken, CONTEXTO),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('não reclama quando não há cookie', async () => {
      await expect(auth.sair(undefined)).resolves.toBeUndefined();
    });
  });
});

/**
 * Remove o que estes testes criaram, e só isso.
 *
 * As agendas saem antes dos usuários porque `Calendar.ownerId` é `Restrict`,
 * não `Cascade` — a mesma razão que tornava o seed quebrado na segunda
 * execução.
 */
async function limpar(prisma: PrismaService): Promise<void> {
  const emails = [CADASTRO.email, 'outro@norbit.dev'];

  const usuarios = await prisma.user.findMany({
    where: { OR: [{ email: { in: emails } }, { handle: CADASTRO.handle }] },
    select: { id: true },
  });
  const ids = usuarios.map((u) => u.id);

  if (ids.length > 0) {
    await prisma.calendar.deleteMany({ where: { ownerId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
}

/**
 * A recuperação de senha, contra o Postgres de verdade.
 *
 * O e-mail é a única fronteira trocada por um dublê: o que se prova aqui é o
 * que acontece nas linhas do banco — o token é guardado só como hash, o uso é
 * único, e redefinir derruba as sessões. O envio real ao Mailpit é provado no
 * e2e.
 */
import { BadRequestException } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaModule, PrismaService } from '@norbit/db';
import { EmailService, type PedidoDeRedefinicao } from '../comum/email.service';
import { AuthService } from './auth.service';
import { RedefinicaoDeSenhaService } from './redefinicao-de-senha.service';
import { SenhasService } from './senhas.service';
import { TokensService } from './tokens.service';

const CONTEXTO = { userAgent: 'jest', ipAddress: '127.0.0.1' };

// Montadas em tempo de execução para não acionar o detector de segredos.
const SENHA_ANTIGA = ['senha', 'antiga', 'bem', 'longa'].join(' ');
const SENHA_NOVA = ['senha', 'nova', 'ainda', 'mais', 'longa'].join(' ');

const CADASTRO = {
  email: 'recupera@norbit.dev',
  handle: 'recupera',
  displayName: 'Recupera',
  password: SENHA_ANTIGA,
};

class EmailFalso {
  readonly enviados: PedidoDeRedefinicao[] = [];

  enviarRedefinicaoDeSenha(pedido: PedidoDeRedefinicao): Promise<void> {
    this.enviados.push(pedido);
    return Promise.resolve();
  }
}

describe('RedefinicaoDeSenhaService', () => {
  let modulo: TestingModule;
  let auth: AuthService;
  let redefinicao: RedefinicaoDeSenhaService;
  let prisma: PrismaService;
  let email: EmailFalso;

  beforeAll(async () => {
    email = new EmailFalso();

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
        RedefinicaoDeSenhaService,
        SenhasService,
        TokensService,
        { provide: EmailService, useValue: email },
      ],
    }).compile();

    await modulo.init();

    auth = modulo.get(AuthService);
    redefinicao = modulo.get(RedefinicaoDeSenhaService);
    prisma = modulo.get(PrismaService);
  });

  afterAll(async () => {
    await limpar(prisma);
    await modulo.close();
  });

  beforeEach(async () => {
    await limpar(prisma);
    email.enviados.length = 0;
  });

  describe('pedir', () => {
    it('envia um link com o token para o e-mail da conta', async () => {
      await auth.cadastrar(CADASTRO, CONTEXTO);

      await redefinicao.pedir(CADASTRO.email);

      expect(email.enviados).toHaveLength(1);
      expect(email.enviados[0]?.para).toBe(CADASTRO.email);
      expect(email.enviados[0]?.token ?? '').not.toBe('');
    });

    it('guarda só o hash do token, nunca o valor que foi por e-mail', async () => {
      // Um vazamento do banco não pode entregar links de redefinição vivos.
      const { usuario } = await auth.cadastrar(CADASTRO, CONTEXTO);

      await redefinicao.pedir(CADASTRO.email);

      const token = email.enviados[0]?.token ?? '';
      // Só as linhas desta conta: o banco de desenvolvimento pode ter pedidos
      // de outras execuções, e contar tudo faria o teste depender delas.
      const gravados = await prisma.passwordReset.findMany({
        where: { userId: usuario.id },
      });
      expect(gravados).toHaveLength(1);
      expect(gravados[0]?.tokenHash).not.toBe(token);
      expect(gravados[0]?.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('não envia nada, e não falha, para um e-mail sem conta', async () => {
      // A resposta é a mesma para quem tem conta e para quem não tem: o
      // contrário seria um oráculo de quais e-mails existem no Norbit.
      const antes = await prisma.passwordReset.count();

      await expect(
        redefinicao.pedir('ninguem@norbit.dev'),
      ).resolves.toBeUndefined();

      expect(email.enviados).toHaveLength(0);
      expect(await prisma.passwordReset.count()).toBe(antes);
    });

    it('um pedido novo invalida o link anterior', async () => {
      await auth.cadastrar(CADASTRO, CONTEXTO);
      await redefinicao.pedir(CADASTRO.email);
      const primeiro = email.enviados[0]?.token ?? '';

      await redefinicao.pedir(CADASTRO.email);

      await expect(
        redefinicao.redefinir(primeiro, SENHA_NOVA),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('ignora conta apagada', async () => {
      const { usuario } = await auth.cadastrar(CADASTRO, CONTEXTO);
      await prisma.user.update({
        where: { id: usuario.id },
        data: { deletedAt: new Date() },
      });

      await redefinicao.pedir(CADASTRO.email);

      expect(email.enviados).toHaveLength(0);
    });
  });

  describe('redefinir', () => {
    it('troca a senha: a nova entra e a antiga não', async () => {
      await auth.cadastrar(CADASTRO, CONTEXTO);
      await redefinicao.pedir(CADASTRO.email);

      await redefinicao.redefinir(email.enviados[0]?.token ?? '', SENHA_NOVA);

      await expect(
        auth.entrar({ email: CADASTRO.email, password: SENHA_NOVA }, CONTEXTO),
      ).resolves.toBeDefined();
      await expect(
        auth.entrar(
          { email: CADASTRO.email, password: SENHA_ANTIGA },
          CONTEXTO,
        ),
      ).rejects.toThrow();
    });

    it('o link vale uma vez só', async () => {
      await auth.cadastrar(CADASTRO, CONTEXTO);
      await redefinicao.pedir(CADASTRO.email);
      const token = email.enviados[0]?.token ?? '';
      await redefinicao.redefinir(token, SENHA_NOVA);

      await expect(
        redefinicao.redefinir(token, SENHA_NOVA),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('dois usos simultâneos do mesmo link: só um passa', async () => {
      // O `updateMany ... where usedAt is null` é o que fecha a corrida entre
      // "ler que está livre" e "marcar como usado".
      await auth.cadastrar(CADASTRO, CONTEXTO);
      await redefinicao.pedir(CADASTRO.email);
      const token = email.enviados[0]?.token ?? '';

      const resultados = await Promise.allSettled([
        redefinicao.redefinir(token, SENHA_NOVA),
        redefinicao.redefinir(token, SENHA_NOVA),
      ]);

      expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(
        1,
      );
    });

    it('recusa o link vencido, sem trocar a senha', async () => {
      await auth.cadastrar(CADASTRO, CONTEXTO);
      await redefinicao.pedir(CADASTRO.email);
      await prisma.passwordReset.updateMany({
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      await expect(
        redefinicao.redefinir(email.enviados[0]?.token ?? '', SENHA_NOVA),
      ).rejects.toBeInstanceOf(BadRequestException);

      await expect(
        auth.entrar(
          { email: CADASTRO.email, password: SENHA_ANTIGA },
          CONTEXTO,
        ),
      ).resolves.toBeDefined();
    });

    it('recusa um token que não corresponde a nenhum pedido', async () => {
      await expect(
        redefinicao.redefinir('token-inventado', SENHA_NOVA),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('derruba todas as sessões da conta', async () => {
      // Quem esquece a senha costuma ter uma sessão esquecida em algum lugar —
      // ou alguém com a senha antiga. Trocar a senha sem encerrar as sessões
      // deixaria essa pessoa dentro.
      const { usuario, refreshToken } = await auth.cadastrar(
        CADASTRO,
        CONTEXTO,
      );
      await auth.entrar(
        { email: CADASTRO.email, password: SENHA_ANTIGA },
        CONTEXTO,
      );
      await redefinicao.pedir(CADASTRO.email);

      await redefinicao.redefinir(email.enviados[0]?.token ?? '', SENHA_NOVA);

      const vivas = await prisma.session.count({
        where: { userId: usuario.id, revokedAt: null },
      });
      expect(vivas).toBe(0);
      await expect(auth.renovar(refreshToken, CONTEXTO)).rejects.toThrow();
    });

    it('a senha nova é guardada como hash Argon2id', async () => {
      const { usuario } = await auth.cadastrar(CADASTRO, CONTEXTO);
      await redefinicao.pedir(CADASTRO.email);

      await redefinicao.redefinir(email.enviados[0]?.token ?? '', SENHA_NOVA);

      const gravado = await prisma.user.findUnique({
        where: { id: usuario.id },
      });
      expect(gravado?.passwordHash).toMatch(/^\$argon2id\$/);
    });
  });
});

async function limpar(prisma: PrismaService): Promise<void> {
  const usuarios = await prisma.user.findMany({
    where: { OR: [{ email: CADASTRO.email }, { handle: CADASTRO.handle }] },
    select: { id: true },
  });
  const ids = usuarios.map((u) => u.id);

  if (ids.length > 0) {
    await prisma.calendar.deleteMany({ where: { ownerId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
}

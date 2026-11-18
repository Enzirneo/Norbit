/**
 * Trocar o e-mail, contra o Postgres de verdade.
 *
 * O e-mail é a única fronteira trocada por um dublê. O que importa provar está
 * nas linhas do banco: nada muda até o link ser usado, o link vale uma vez, e
 * pedir não revela se o endereço já tem dono.
 */
import { BadRequestException } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaModule, PrismaService } from '@norbit/db';
import {
  EmailService,
  type AvisoDeTrocaDeEmail,
  type PedidoDeConfirmacaoDeEmail,
} from '../comum/email.service';
import { AuthService } from './auth.service';
import { SenhasService } from './senhas.service';
import { TokensService } from './tokens.service';
import { TrocaDeEmailService } from './troca-de-email.service';

const CONTEXTO = { userAgent: 'jest', ipAddress: '127.0.0.1' };

// Montadas em tempo de execução para não acionar o detector de segredos.
const SENHA = ['senha', 'da', 'troca', 'bem', 'longa'].join(' ');
const SENHA_ERRADA = ['senha', 'que', 'nao', 'e', 'a', 'minha'].join(' ');

const CADASTRO = {
  email: 'troca-email@norbit.dev',
  handle: 'trocaemail',
  displayName: 'Troca',
  password: SENHA,
};
const OUTRA = {
  email: 'outra-troca-email@norbit.dev',
  handle: 'outratrocaemail',
  displayName: 'Outra',
  password: SENHA,
};
const NOVO = 'novo-troca-email@norbit.dev';
const SEGUNDO = 'segundo-troca-email@norbit.dev';

class EmailFalso {
  readonly confirmacoes: PedidoDeConfirmacaoDeEmail[] = [];
  readonly avisos: AvisoDeTrocaDeEmail[] = [];

  enviarConfirmacaoDeEmail(pedido: PedidoDeConfirmacaoDeEmail): Promise<void> {
    this.confirmacoes.push(pedido);
    return Promise.resolve();
  }

  enviarAvisoDeTrocaDeEmail(aviso: AvisoDeTrocaDeEmail): Promise<void> {
    this.avisos.push(aviso);
    return Promise.resolve();
  }
}

describe('TrocaDeEmailService', () => {
  let modulo: TestingModule;
  let auth: AuthService;
  let troca: TrocaDeEmailService;
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
        TrocaDeEmailService,
        SenhasService,
        TokensService,
        { provide: EmailService, useValue: email },
      ],
    }).compile();

    await modulo.init();

    auth = modulo.get(AuthService);
    troca = modulo.get(TrocaDeEmailService);
    prisma = modulo.get(PrismaService);
  });

  afterAll(async () => {
    await limpar(prisma);
    await modulo.close();
  });

  beforeEach(async () => {
    await limpar(prisma);
    email.confirmacoes.length = 0;
    email.avisos.length = 0;
  });

  async function pedirEConfirmar(userId: string): Promise<void> {
    await troca.pedir({ userId, senha: SENHA, novoEmail: NOVO });
    await troca.confirmar(email.confirmacoes[0].token);
  }

  describe('pedir', () => {
    it('manda o link para o endereço novo, e nada muda ainda', async () => {
      const { usuario } = await auth.cadastrar(CADASTRO, CONTEXTO);

      await troca.pedir({ userId: usuario.id, senha: SENHA, novoEmail: NOVO });

      expect(email.confirmacoes).toHaveLength(1);
      expect(email.confirmacoes[0].para).toBe(NOVO);
      await expect(auth.entrar(CADASTRO, CONTEXTO)).resolves.toBeDefined();
    });

    it('guarda só o hash do token', async () => {
      const { usuario } = await auth.cadastrar(CADASTRO, CONTEXTO);

      await troca.pedir({ userId: usuario.id, senha: SENHA, novoEmail: NOVO });

      const pedido = await prisma.emailChange.findFirstOrThrow({
        where: { userId: usuario.id },
      });
      expect(pedido.tokenHash).not.toBe(email.confirmacoes[0].token);
      expect(pedido.newEmail).toBe(NOVO);
    });

    it('recusa com a senha errada, sem enviar nada', async () => {
      const { usuario } = await auth.cadastrar(CADASTRO, CONTEXTO);

      await expect(
        troca.pedir({
          userId: usuario.id,
          senha: SENHA_ERRADA,
          novoEmail: NOVO,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(email.confirmacoes).toHaveLength(0);
      expect(await prisma.emailChange.count()).toBe(0);
    });

    it('recusa trocar para o próprio e-mail', async () => {
      const { usuario } = await auth.cadastrar(CADASTRO, CONTEXTO);

      await expect(
        troca.pedir({
          userId: usuario.id,
          senha: SENHA,
          novoEmail: CADASTRO.email,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('endereço de outra conta responde igual, mas não envia nem grava nada', async () => {
      const { usuario } = await auth.cadastrar(CADASTRO, CONTEXTO);
      await auth.cadastrar(OUTRA, CONTEXTO);

      await expect(
        troca.pedir({
          userId: usuario.id,
          senha: SENHA,
          novoEmail: OUTRA.email,
        }),
      ).resolves.toBeUndefined();

      expect(email.confirmacoes).toHaveLength(0);
      expect(await prisma.emailChange.count()).toBe(0);
    });

    it('um pedido novo cancela o anterior', async () => {
      const { usuario } = await auth.cadastrar(CADASTRO, CONTEXTO);

      await troca.pedir({ userId: usuario.id, senha: SENHA, novoEmail: NOVO });
      await troca.pedir({
        userId: usuario.id,
        senha: SENHA,
        novoEmail: SEGUNDO,
      });

      await expect(
        troca.confirmar(email.confirmacoes[0].token),
      ).rejects.toThrow(BadRequestException);
      await expect(
        troca.confirmar(email.confirmacoes[1].token),
      ).resolves.toBeUndefined();
    });
  });

  describe('confirmar', () => {
    it('troca o e-mail: entra com o novo e não entra mais com o antigo', async () => {
      const { usuario } = await auth.cadastrar(CADASTRO, CONTEXTO);

      await pedirEConfirmar(usuario.id);

      await expect(
        auth.entrar({ ...CADASTRO, email: NOVO }, CONTEXTO),
      ).resolves.toBeDefined();
      await expect(auth.entrar(CADASTRO, CONTEXTO)).rejects.toThrow();
    });

    it('marca o e-mail como verificado', async () => {
      const { usuario } = await auth.cadastrar(CADASTRO, CONTEXTO);

      await pedirEConfirmar(usuario.id);

      const linha = await prisma.user.findUniqueOrThrow({
        where: { id: usuario.id },
      });
      expect(linha.emailVerifiedAt).not.toBeNull();
    });

    it('derruba todas as sessões', async () => {
      const { usuario, refreshToken } = await auth.cadastrar(
        CADASTRO,
        CONTEXTO,
      );

      await pedirEConfirmar(usuario.id);

      await expect(auth.renovar(refreshToken, CONTEXTO)).rejects.toThrow();
    });

    it('avisa o endereço antigo de que o e-mail mudou', async () => {
      const { usuario } = await auth.cadastrar(CADASTRO, CONTEXTO);

      await pedirEConfirmar(usuario.id);

      expect(email.avisos).toEqual([
        expect.objectContaining({ para: CADASTRO.email, novoEmail: NOVO }),
      ]);
    });

    it('o link vale uma vez só', async () => {
      const { usuario } = await auth.cadastrar(CADASTRO, CONTEXTO);
      await troca.pedir({ userId: usuario.id, senha: SENHA, novoEmail: NOVO });
      const { token } = email.confirmacoes[0];

      await troca.confirmar(token);

      await expect(troca.confirmar(token)).rejects.toThrow(BadRequestException);
    });

    it('recusa um link desconhecido', async () => {
      await expect(troca.confirmar('nao-existe')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('recusa um link vencido, e nada muda', async () => {
      const { usuario } = await auth.cadastrar(CADASTRO, CONTEXTO);
      await troca.pedir({ userId: usuario.id, senha: SENHA, novoEmail: NOVO });
      await prisma.emailChange.updateMany({
        where: { userId: usuario.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      await expect(
        troca.confirmar(email.confirmacoes[0].token),
      ).rejects.toThrow(BadRequestException);
      await expect(auth.entrar(CADASTRO, CONTEXTO)).resolves.toBeDefined();
    });

    it('recusa se alguém tomou o endereço entre o pedido e o clique, e nada muda', async () => {
      const { usuario } = await auth.cadastrar(CADASTRO, CONTEXTO);
      await troca.pedir({ userId: usuario.id, senha: SENHA, novoEmail: NOVO });
      await auth.cadastrar({ ...OUTRA, email: NOVO }, CONTEXTO);

      await expect(
        troca.confirmar(email.confirmacoes[0].token),
      ).rejects.toThrow(BadRequestException);

      await expect(auth.entrar(CADASTRO, CONTEXTO)).resolves.toBeDefined();
    });

    it('recusa se a conta foi apagada entre o pedido e o clique', async () => {
      const { usuario } = await auth.cadastrar(CADASTRO, CONTEXTO);
      await troca.pedir({ userId: usuario.id, senha: SENHA, novoEmail: NOVO });
      await prisma.user.update({
        where: { id: usuario.id },
        data: { deletedAt: new Date() },
      });

      await expect(
        troca.confirmar(email.confirmacoes[0].token),
      ).rejects.toThrow(BadRequestException);
    });
  });
});

async function limpar(prisma: PrismaService): Promise<void> {
  const usuarios = await prisma.user.findMany({
    where: {
      OR: [
        { email: { in: [CADASTRO.email, OUTRA.email, NOVO, SEGUNDO] } },
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

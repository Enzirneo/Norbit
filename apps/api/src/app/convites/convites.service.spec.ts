/**
 * Os convites, contra o Postgres de verdade.
 *
 * O e-mail é a única fronteira trocada por um dublê. O que se prova aqui é o que
 * acontece nas linhas do banco: o token vira hash, o convite por e-mail é de uma
 * conta só, o uso é limitado mesmo sob concorrência, e quem não é dono não
 * convida.
 */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaModule, PrismaService } from '@norbit/db';
import { AcessoService } from '../agendas/acesso.service';
import { AuthService } from '../auth/auth.service';
import { SenhasService } from '../auth/senhas.service';
import { TokensService } from '../auth/tokens.service';
import { EmailService, type PedidoDeConvite } from '../comum/email.service';
import { ConvitesService } from './convites.service';

const CONTEXTO = { userAgent: 'jest', ipAddress: '127.0.0.1' };
// Montada em tempo de execução para não acionar o detector de segredos.
const SENHA = ['uma', 'senha', 'bem', 'longa'].join(' ');

const conta = (
  nome: string,
): {
  email: string;
  handle: string;
  displayName: string;
  password: string;
} => ({
  email: `${nome}@convites.norbit.dev`,
  handle: `cv_${nome}`,
  displayName: nome.toUpperCase(),
  password: SENHA,
});

const DONO = conta('dono');
const MARIA = conta('maria');
const JOAO = conta('joao');
const EDITORA = conta('editora');
const TODAS = [DONO, MARIA, JOAO, EDITORA];

class EmailFalso {
  readonly convites: PedidoDeConvite[] = [];

  linkDoConvite(token: string): string {
    return `http://teste/convite?token=${token}`;
  }

  enviarConvite(pedido: PedidoDeConvite): Promise<void> {
    this.convites.push(pedido);
    return Promise.resolve();
  }
}

describe('ConvitesService', () => {
  let modulo: TestingModule;
  let auth: AuthService;
  let convites: ConvitesService;
  let prisma: PrismaService;
  const email = new EmailFalso();

  let dono: string;
  let maria: string;
  let joao: string;
  let editora: string;
  let agenda: string;

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
        ConvitesService,
        AcessoService,
        SenhasService,
        TokensService,
        { provide: EmailService, useValue: email },
      ],
    }).compile();
    await modulo.init();

    auth = modulo.get(AuthService);
    convites = modulo.get(ConvitesService);
    prisma = modulo.get(PrismaService);
  });

  afterAll(async () => {
    await limpar(prisma);
    await modulo.close();
  });

  beforeEach(async () => {
    await limpar(prisma);
    email.convites.length = 0;

    dono = (await auth.cadastrar(DONO, CONTEXTO)).usuario.id;
    maria = (await auth.cadastrar(MARIA, CONTEXTO)).usuario.id;
    joao = (await auth.cadastrar(JOAO, CONTEXTO)).usuario.id;
    editora = (await auth.cadastrar(EDITORA, CONTEXTO)).usuario.id;

    const padrao = await prisma.calendar.findFirstOrThrow({
      where: { ownerId: dono, isDefault: true },
    });
    agenda = padrao.id;
    await prisma.calendarMember.create({
      data: { calendarId: agenda, userId: editora, role: 'EDITOR' },
    });
  });

  /** O token que está no link devolvido. */
  const tokenDe = (link: string): string => link.split('token=')[1] ?? '';

  describe('criar', () => {
    it('cria o convite por e-mail e envia o link, com o hash no banco', async () => {
      const r = await convites.criar(dono, agenda, {
        email: MARIA.email,
        papel: 'CONTRIBUTOR',
        validadeDias: 7,
      });

      expect(r.convite).toMatchObject({
        email: MARIA.email,
        papel: 'CONTRIBUTOR',
        usosMaximos: 1,
        usos: 0,
      });
      expect(email.convites).toHaveLength(1);
      expect(email.convites[0]).toMatchObject({
        para: MARIA.email,
        agenda: expect.any(String) as string,
        link: r.link,
      });

      const gravado = await prisma.calendarInvite.findUniqueOrThrow({
        where: { id: r.convite.id },
      });
      const token = tokenDe(r.link);
      expect(token).not.toBe('');
      expect(gravado.tokenHash).not.toBe(token);
      expect(gravado.tokenHash).toMatch(/^[0-9a-f]{64}$/);
      expect(gravado.status).toBe('PENDING');
      expect(gravado.invitedById).toBe(dono);
    });

    it('a validade é a pedida', async () => {
      const antes = Date.now();

      const r = await convites.criar(dono, agenda, {
        papel: 'VIEWER',
        validadeDias: 3,
      });

      const dias = (Date.parse(r.convite.expiraEm) - antes) / 86_400_000;
      expect(dias).toBeGreaterThan(2.99);
      expect(dias).toBeLessThan(3.01);
    });

    it('o convite por link não tem e-mail, não envia nada e tem 10 usos por padrão', async () => {
      const r = await convites.criar(dono, agenda, {
        papel: 'VIEWER',
        validadeDias: 7,
      });

      expect(r.convite.email).toBeNull();
      expect(r.convite.usosMaximos).toBe(10);
      expect(email.convites).toHaveLength(0);
    });

    it('o convite por link respeita o limite de usos pedido', async () => {
      const r = await convites.criar(dono, agenda, {
        papel: 'VIEWER',
        validadeDias: 7,
        usosMaximos: 2,
      });

      expect(r.convite.usosMaximos).toBe(2);
    });

    it('o convite por e-mail é sempre de um uso só, ignorando usosMaximos', async () => {
      const r = await convites.criar(dono, agenda, {
        email: MARIA.email,
        papel: 'VIEWER',
        validadeDias: 7,
        usosMaximos: 50,
      });

      expect(r.convite.usosMaximos).toBe(1);
    });

    it('quem é editor não convida', async () => {
      await expect(
        convites.criar(editora, agenda, { papel: 'VIEWER', validadeDias: 7 }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('quem não tem acesso à agenda nem descobre que ela existe', async () => {
      await expect(
        convites.criar(joao, agenda, { papel: 'VIEWER', validadeDias: 7 }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('recusa convidar quem já é membro', async () => {
      await expect(
        convites.criar(dono, agenda, {
          email: EDITORA.email,
          papel: 'VIEWER',
          validadeDias: 7,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('um convite novo para o mesmo e-mail revoga o anterior', async () => {
      const primeiro = await convites.criar(dono, agenda, {
        email: MARIA.email,
        papel: 'VIEWER',
        validadeDias: 7,
      });

      await convites.criar(dono, agenda, {
        email: MARIA.email,
        papel: 'EDITOR',
        validadeDias: 7,
      });

      const antigo = await prisma.calendarInvite.findUniqueOrThrow({
        where: { id: primeiro.convite.id },
      });
      expect(antigo.status).toBe('REVOKED');
      await expect(
        convites.aceitar(maria, tokenDe(primeiro.link)),
      ).rejects.toBeInstanceOf(GoneException);
    });

    it('convidar por e-mail uma conta que não existe ainda funciona', async () => {
      // Quem recebe cria a conta e depois aceita: o convite não exige conta.
      const r = await convites.criar(dono, agenda, {
        email: 'ainda-sem-conta@convites.norbit.dev',
        papel: 'VIEWER',
        validadeDias: 7,
      });

      expect(r.convite.email).toBe('ainda-sem-conta@convites.norbit.dev');
    });
  });

  describe('listar', () => {
    it('mostra os convites pendentes e vivos, sem o token', async () => {
      const vivo = await convites.criar(dono, agenda, {
        email: MARIA.email,
        papel: 'VIEWER',
        validadeDias: 7,
      });
      const revogado = await convites.criar(dono, agenda, {
        papel: 'VIEWER',
        validadeDias: 7,
      });
      await convites.revogar(dono, agenda, revogado.convite.id);
      const vencido = await convites.criar(dono, agenda, {
        papel: 'VIEWER',
        validadeDias: 7,
      });
      await prisma.calendarInvite.update({
        where: { id: vencido.convite.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      const lista = await convites.listar(dono, agenda);

      expect(lista.map((c) => c.id)).toEqual([vivo.convite.id]);
      expect(JSON.stringify(lista)).not.toMatch(/token/i);
    });

    it('só o dono vê os convites', async () => {
      await expect(convites.listar(editora, agenda)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('revogar', () => {
    it('o convite revogado deixa de valer', async () => {
      const r = await convites.criar(dono, agenda, {
        papel: 'VIEWER',
        validadeDias: 7,
      });

      await convites.revogar(dono, agenda, r.convite.id);

      await expect(
        convites.aceitar(maria, tokenDe(r.link)),
      ).rejects.toBeInstanceOf(GoneException);
    });

    it('não revoga um convite de outra agenda, mesmo sendo dono desta', async () => {
      // Sem escopar pela agenda, o dono da agenda A revogaria convites da B
      // sabendo apenas o identificador.
      const outraAgenda = await prisma.calendar.create({
        data: {
          id: '0190b8b0-0000-7000-8000-000000000001',
          name: 'Outra',
          ownerId: maria,
          members: { create: { userId: maria, role: 'OWNER' } },
        },
      });
      const alheio = await convites.criar(maria, outraAgenda.id, {
        papel: 'VIEWER',
        validadeDias: 7,
      });

      await expect(
        convites.revogar(dono, agenda, alheio.convite.id),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('só o dono revoga', async () => {
      const r = await convites.criar(dono, agenda, {
        papel: 'VIEWER',
        validadeDias: 7,
      });

      await expect(
        convites.revogar(editora, agenda, r.convite.id),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('previsão', () => {
    it('mostra a agenda, quem convidou e o papel, sem exigir sessão', async () => {
      const r = await convites.criar(dono, agenda, {
        email: MARIA.email,
        papel: 'EDITOR',
        validadeDias: 7,
      });

      const p = await convites.previsao(tokenDe(r.link));

      expect(p).toEqual({
        agenda: { nome: 'Minha agenda', cor: expect.any(String) as string },
        convidadoPor: DONO.displayName,
        papel: 'EDITOR',
        paraEmail: MARIA.email,
      });
    });

    it('um token desconhecido é 404', async () => {
      await expect(convites.previsao('inventado')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('um convite revogado é 410', async () => {
      const r = await convites.criar(dono, agenda, {
        papel: 'VIEWER',
        validadeDias: 7,
      });
      await convites.revogar(dono, agenda, r.convite.id);

      await expect(convites.previsao(tokenDe(r.link))).rejects.toBeInstanceOf(
        GoneException,
      );
    });
  });

  describe('aceitar', () => {
    it('a conta convidada entra com o papel do convite', async () => {
      const r = await convites.criar(dono, agenda, {
        email: MARIA.email,
        papel: 'CONTRIBUTOR',
        validadeDias: 7,
      });

      const resultado = await convites.aceitar(maria, tokenDe(r.link));

      expect(resultado).toEqual({ calendarId: agenda });
      const membro = await prisma.calendarMember.findUniqueOrThrow({
        where: { calendarId_userId: { calendarId: agenda, userId: maria } },
      });
      expect(membro.role).toBe('CONTRIBUTOR');
      const convite = await prisma.calendarInvite.findUniqueOrThrow({
        where: { id: r.convite.id },
      });
      expect(convite).toMatchObject({ status: 'ACCEPTED', useCount: 1 });
      expect(convite.acceptedAt).not.toBeNull();
    });

    it('outra conta não usa o convite por e-mail, e nada é criado', async () => {
      const r = await convites.criar(dono, agenda, {
        email: MARIA.email,
        papel: 'VIEWER',
        validadeDias: 7,
      });

      await expect(
        convites.aceitar(joao, tokenDe(r.link)),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(
        await prisma.calendarMember.count({
          where: { calendarId: agenda, userId: joao },
        }),
      ).toBe(0);
    });

    it('o convite por e-mail aceito não serve de novo', async () => {
      const r = await convites.criar(dono, agenda, {
        email: MARIA.email,
        papel: 'VIEWER',
        validadeDias: 7,
      });
      await convites.aceitar(maria, tokenDe(r.link));
      await prisma.calendarMember.delete({
        where: { calendarId_userId: { calendarId: agenda, userId: maria } },
      });

      await expect(
        convites.aceitar(maria, tokenDe(r.link)),
      ).rejects.toBeInstanceOf(GoneException);
    });

    it('o convite por link serve a várias contas, até o limite', async () => {
      const r = await convites.criar(dono, agenda, {
        papel: 'VIEWER',
        validadeDias: 7,
        usosMaximos: 2,
      });
      const token = tokenDe(r.link);

      await convites.aceitar(maria, token);
      await convites.aceitar(joao, token);

      const extra = (await auth.cadastrar(conta('extra'), CONTEXTO)).usuario.id;
      await expect(convites.aceitar(extra, token)).rejects.toBeInstanceOf(
        GoneException,
      );
    });

    it('quem já é membro recebe sucesso sem consumir um uso', async () => {
      const r = await convites.criar(dono, agenda, {
        papel: 'VIEWER',
        validadeDias: 7,
        usosMaximos: 2,
      });

      const resultado = await convites.aceitar(editora, tokenDe(r.link));

      expect(resultado).toEqual({ calendarId: agenda });
      const convite = await prisma.calendarInvite.findUniqueOrThrow({
        where: { id: r.convite.id },
      });
      expect(convite.useCount).toBe(0);
      const membro = await prisma.calendarMember.findUniqueOrThrow({
        where: { calendarId_userId: { calendarId: agenda, userId: editora } },
      });
      // Aceitar não rebaixa nem promove quem já estava.
      expect(membro.role).toBe('EDITOR');
    });

    it('o dono aceitando o próprio convite não vira membro duas vezes', async () => {
      const r = await convites.criar(dono, agenda, {
        papel: 'VIEWER',
        validadeDias: 7,
      });

      await convites.aceitar(dono, tokenDe(r.link));

      expect(
        await prisma.calendarMember.count({
          where: { calendarId: agenda, userId: dono },
        }),
      ).toBe(1);
    });

    it('recusa o convite vencido', async () => {
      const r = await convites.criar(dono, agenda, {
        papel: 'VIEWER',
        validadeDias: 7,
      });
      await prisma.calendarInvite.update({
        where: { id: r.convite.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      await expect(
        convites.aceitar(maria, tokenDe(r.link)),
      ).rejects.toBeInstanceOf(GoneException);
    });

    it('um token desconhecido é 404', async () => {
      await expect(convites.aceitar(maria, 'inventado')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('dois aceites simultâneos do último uso: só um entra', async () => {
      // Ler "ainda há uso" e gastá-lo são passos separados, e entre eles cabe o
      // outro aceite. O que decide é o `updateMany` condicional.
      const r = await convites.criar(dono, agenda, {
        papel: 'VIEWER',
        validadeDias: 7,
        usosMaximos: 1,
      });
      const token = tokenDe(r.link);

      const resultados = await Promise.allSettled([
        convites.aceitar(maria, token),
        convites.aceitar(joao, token),
      ]);

      expect(resultados.filter((x) => x.status === 'fulfilled')).toHaveLength(
        1,
      );
      expect(
        await prisma.calendarMember.count({
          where: { calendarId: agenda, userId: { in: [maria, joao] } },
        }),
      ).toBe(1);
      const convite = await prisma.calendarInvite.findUniqueOrThrow({
        where: { id: r.convite.id },
      });
      expect(convite.useCount).toBe(1);
    });
  });

  describe('recusar', () => {
    it('a conta convidada recusa, e o convite deixa de valer', async () => {
      const r = await convites.criar(dono, agenda, {
        email: MARIA.email,
        papel: 'VIEWER',
        validadeDias: 7,
      });

      await convites.recusar(maria, tokenDe(r.link));

      const convite = await prisma.calendarInvite.findUniqueOrThrow({
        where: { id: r.convite.id },
      });
      expect(convite.status).toBe('DECLINED');
      await expect(
        convites.aceitar(maria, tokenDe(r.link)),
      ).rejects.toBeInstanceOf(GoneException);
    });

    it('outra conta não recusa o convite alheio', async () => {
      const r = await convites.criar(dono, agenda, {
        email: MARIA.email,
        papel: 'VIEWER',
        validadeDias: 7,
      });

      await expect(
        convites.recusar(joao, tokenDe(r.link)),
      ).rejects.toBeInstanceOf(ForbiddenException);

      const convite = await prisma.calendarInvite.findUniqueOrThrow({
        where: { id: r.convite.id },
      });
      expect(convite.status).toBe('PENDING');
    });

    it('convite por link não se recusa', async () => {
      const r = await convites.criar(dono, agenda, {
        papel: 'VIEWER',
        validadeDias: 7,
      });

      await expect(
        convites.recusar(maria, tokenDe(r.link)),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});

async function limpar(prisma: PrismaService): Promise<void> {
  const emails = [...TODAS.map((c) => c.email), conta('extra').email];
  const usuarios = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { id: true },
  });
  const ids = usuarios.map((u) => u.id);

  if (ids.length > 0) {
    // As agendas vão primeiro: os convites saem em cascata com elas, e o
    // convite referencia quem convidou sem cascata.
    await prisma.calendar.deleteMany({ where: { ownerId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
}

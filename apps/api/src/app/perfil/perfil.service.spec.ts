/**
 * O perfil, contra o Postgres de verdade.
 */
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaModule, PrismaService } from '@norbit/db';
import { AuthService } from '../auth/auth.service';
import { SenhasService } from '../auth/senhas.service';
import { TokensService } from '../auth/tokens.service';
import { PerfilService } from './perfil.service';

const CONTEXTO = { userAgent: 'jest', ipAddress: '127.0.0.1' };
const SENHA = ['uma', 'senha', 'bem', 'longa'].join(' ');

const A = {
  email: 'perfil-a@norbit.dev',
  handle: 'perfil_a',
  displayName: 'Perfil A',
  password: SENHA,
};
const B = {
  email: 'perfil-b@norbit.dev',
  handle: 'perfil_b',
  displayName: 'Perfil B',
  password: SENHA,
};

describe('PerfilService', () => {
  let modulo: TestingModule;
  let auth: AuthService;
  let perfil: PerfilService;
  let prisma: PrismaService;
  let idA: string;

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
      providers: [AuthService, PerfilService, SenhasService, TokensService],
    }).compile();
    await modulo.init();

    auth = modulo.get(AuthService);
    perfil = modulo.get(PerfilService);
    prisma = modulo.get(PrismaService);
  });

  afterAll(async () => {
    await limpar(prisma);
    await modulo.close();
  });

  beforeEach(async () => {
    await limpar(prisma);
    idA = (await auth.cadastrar(A, CONTEXTO)).usuario.id;
    await auth.cadastrar(B, CONTEXTO);
  });

  it('altera nome, handle e fuso, e devolve o usuário atualizado', async () => {
    const r = await perfil.atualizar(idA, {
      displayName: 'Novo Nome',
      handle: 'perfil_novo',
      timeZone: 'America/Manaus',
    });

    expect(r).toMatchObject({
      id: idA,
      displayName: 'Novo Nome',
      handle: 'perfil_novo',
      timeZone: 'America/Manaus',
      email: A.email,
    });
    const gravado = await prisma.user.findUnique({ where: { id: idA } });
    expect(gravado?.handle).toBe('perfil_novo');
  });

  it('altera só o que foi enviado', async () => {
    const r = await perfil.atualizar(idA, { displayName: 'Só o nome' });

    expect(r.displayName).toBe('Só o nome');
    expect(r.handle).toBe(A.handle);
    expect(r.timeZone).toBe('America/Sao_Paulo');
  });

  it('recusa um handle que já é de outra conta', async () => {
    await expect(
      perfil.atualizar(idA, { handle: B.handle }),
    ).rejects.toBeInstanceOf(ConflictException);

    const gravado = await prisma.user.findUnique({ where: { id: idA } });
    expect(gravado?.handle).toBe(A.handle);
  });

  it('aceita "trocar" o handle pelo mesmo que já é seu', async () => {
    await expect(
      perfil.atualizar(idA, { handle: A.handle }),
    ).resolves.toMatchObject({ handle: A.handle });
  });

  it('não toca no e-mail nem na senha', async () => {
    const antes = await prisma.user.findUnique({ where: { id: idA } });

    await perfil.atualizar(idA, { displayName: 'Outro' });

    const depois = await prisma.user.findUnique({ where: { id: idA } });
    expect(depois?.email).toBe(antes?.email);
    expect(depois?.passwordHash).toBe(antes?.passwordHash);
  });

  it('não encontra conta apagada', async () => {
    await prisma.user.update({
      where: { id: idA },
      data: { deletedAt: new Date() },
    });

    await expect(
      perfil.atualizar(idA, { displayName: 'X' }),
    ).rejects.toBeInstanceOf(NotFoundException);

    // Recusar não basta: a edição não pode ter sido gravada por baixo. Um
    // `update` sem o filtro de conta apagada lançaria o mesmo erro depois de
    // já ter alterado a linha.
    const gravado = await prisma.user.findUnique({ where: { id: idA } });
    expect(gravado?.displayName).toBe(A.displayName);
  });
});

async function limpar(prisma: PrismaService): Promise<void> {
  const usuarios = await prisma.user.findMany({
    where: { email: { in: [A.email, B.email] } },
    select: { id: true },
  });
  const ids = usuarios.map((u) => u.id);

  if (ids.length > 0) {
    await prisma.calendar.deleteMany({ where: { ownerId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
}

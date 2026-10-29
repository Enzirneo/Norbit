/**
 * Testes de integração das agendas, contra o Postgres de verdade.
 *
 * A matriz de permissões já é testada como função pura em `libs/domain`. O que
 * **estes** testes provam é outra coisa: que o caminho do banco passa por ela.
 * Um mock do Prisma aqui provaria apenas que o serviço chama os métodos que eu
 * escrevi que ele chamaria — e o defeito que importa nesta camada é justamente
 * a consulta que esquece um filtro e devolve a agenda de outra pessoa.
 */
import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaModule, PrismaService } from '@norbit/db';
import { uuidv7 } from 'uuidv7';
import { AcessoService } from './acesso.service';
import { AgendasService } from './agendas.service';

const PREFIXO = 'teste-agendas';

describe('AgendasService', () => {
  let modulo: TestingModule;
  let agendas: AgendasService;
  let acesso: AcessoService;
  let prisma: PrismaService;

  let enzo: string;
  let maria: string;

  beforeAll(async () => {
    modulo = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule],
      providers: [AgendasService, AcessoService],
    }).compile();

    await modulo.init();

    agendas = modulo.get(AgendasService);
    acesso = modulo.get(AcessoService);
    prisma = modulo.get(PrismaService);
  });

  afterAll(async () => {
    await limpar(prisma);
    await modulo.close();
  });

  beforeEach(async () => {
    await limpar(prisma);
    enzo = await criarUsuario(prisma, 'enzo');
    maria = await criarUsuario(prisma, 'maria');
  });

  describe('criar', () => {
    it('cria a agenda e a linha de membro do dono', async () => {
      const agenda = await agendas.criar(enzo, {
        name: 'Casa',
        kind: 'SHARED',
        color: '#ff8a3d',
      });

      expect(agenda.papel).toBe('OWNER');
      expect(agenda.ownerId).toBe(enzo);

      // A linha de membro é o que faz o dono aparecer na lista de membros. Sem
      // ela ele seria dono invisível — e o defeito só apareceria numa tela.
      const membros = await prisma.calendarMember.findMany({
        where: { calendarId: agenda.id },
      });
      expect(membros).toEqual([
        expect.objectContaining({ userId: enzo, role: 'OWNER' }),
      ]);
    });

    it('herda o fuso de quem cria quando nenhum é informado', async () => {
      await prisma.user.update({
        where: { id: enzo },
        data: { timeZone: 'America/New_York' },
      });

      const agenda = await agendas.criar(enzo, {
        name: 'Trabalho',
        kind: 'PERSONAL',
        color: '#6d7cff',
      });

      expect(agenda.timeZone).toBe('America/New_York');
    });
  });

  describe('listar', () => {
    it('traz as minhas e as que sou membro, nunca as dos outros', async () => {
      const minha = await agendas.criar(enzo, {
        name: 'Minha',
        kind: 'PERSONAL',
        color: '#6d7cff',
      });
      const daMaria = await agendas.criar(maria, {
        name: 'Da Maria',
        kind: 'PERSONAL',
        color: '#6d7cff',
      });
      const compartilhada = await agendas.criar(maria, {
        name: 'Compartilhada',
        kind: 'SHARED',
        color: '#6d7cff',
      });
      await virarMembro(prisma, compartilhada.id, enzo, 'VIEWER');

      const lista = await agendas.listar(enzo);
      const ids = lista.map((a) => a.id);

      expect(ids).toContain(minha.id);
      expect(ids).toContain(compartilhada.id);
      expect(ids).not.toContain(daMaria.id);
    });

    it('traz o papel de quem pediu, não o do dono', async () => {
      const compartilhada = await agendas.criar(maria, {
        name: 'Compartilhada',
        kind: 'SHARED',
        color: '#6d7cff',
      });
      await virarMembro(prisma, compartilhada.id, enzo, 'CONTRIBUTOR');

      const [agenda] = await agendas.listar(enzo);

      expect(agenda?.papel).toBe('CONTRIBUTOR');
    });

    it('não traz agenda excluída', async () => {
      const agenda = await agendas.criar(enzo, {
        name: 'Vai sair',
        kind: 'PERSONAL',
        color: '#6d7cff',
      });
      await agendas.remover(enzo, agenda.id);

      expect(await agendas.listar(enzo)).toEqual([]);
    });
  });

  describe('a agenda de outra pessoa', () => {
    it('responde 404, e não 403', async () => {
      // Responder 403 para o que existe e 404 para o que não existe
      // transformaria a rota num oráculo de identificadores válidos.
      const daMaria = await agendas.criar(maria, {
        name: 'Da Maria',
        kind: 'PERSONAL',
        color: '#6d7cff',
      });

      await expect(
        acesso.abrir({ calendarId: daMaria.id, userId: enzo, acao: 'ver' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('dá a mesma resposta de uma agenda que nunca existiu', async () => {
      await expect(
        acesso.abrir({ calendarId: uuidv7(), userId: enzo, acao: 'ver' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('a matriz valendo no caminho do banco', () => {
    it('o VIEWER não cria evento', async () => {
      const id = await agendaDoEnzoCom(maria, 'VIEWER');

      await expect(
        acesso.abrir({ calendarId: id, userId: maria, acao: 'criar-evento' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('o EDITOR não altera a agenda', async () => {
      const id = await agendaDoEnzoCom(maria, 'EDITOR');

      await expect(
        agendas.atualizar({
          userId: maria,
          calendarId: id,
          dados: { name: 'Renomeada' },
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('o dono altera', async () => {
      const id = await agendaDoEnzoCom(maria, 'EDITOR');

      const atualizada = await agendas.atualizar({
        userId: enzo,
        calendarId: id,
        dados: { name: 'Renomeada' },
      });

      expect(atualizada.name).toBe('Renomeada');
    });
  });

  describe('arquivar', () => {
    it('vira booleano para fora e instante para dentro', async () => {
      const agenda = await agendas.criar(enzo, {
        name: 'Projeto antigo',
        kind: 'PERSONAL',
        color: '#6d7cff',
      });

      const arquivada = await agendas.atualizar({
        userId: enzo,
        calendarId: agenda.id,
        dados: { arquivada: true },
      });
      expect(arquivada.arquivada).toBe(true);

      const linha = await prisma.calendar.findUniqueOrThrow({
        where: { id: agenda.id },
      });
      expect(linha.archivedAt).toBeInstanceOf(Date);

      const voltou = await agendas.atualizar({
        userId: enzo,
        calendarId: agenda.id,
        dados: { arquivada: false },
      });
      expect(voltou.arquivada).toBe(false);
    });
  });

  describe('remover', () => {
    it('recusa excluir a agenda padrão', async () => {
      const agenda = await agendas.criar(enzo, {
        name: 'Padrão',
        kind: 'PERSONAL',
        color: '#6d7cff',
      });
      await prisma.calendar.update({
        where: { id: agenda.id },
        data: { isDefault: true },
      });

      await expect(agendas.remover(enzo, agenda.id)).rejects.toThrow(
        ConflictException,
      );
    });

    it('é exclusão lógica: a linha fica e os eventos não são destruídos', async () => {
      const agenda = await agendas.criar(enzo, {
        name: 'Vai sair',
        kind: 'SHARED',
        color: '#6d7cff',
      });

      await agendas.remover(enzo, agenda.id);

      const linha = await prisma.calendar.findUniqueOrThrow({
        where: { id: agenda.id },
      });
      expect(linha.deletedAt).toBeInstanceOf(Date);
    });
  });

  describe('membros', () => {
    it('mostra o dono como OWNER e o convidado com o papel dele', async () => {
      const id = await agendaDoEnzoCom(maria, 'CONTRIBUTOR');

      const lista = await agendas.membros(enzo, id);

      expect(lista).toEqual([
        expect.objectContaining({ userId: enzo, papel: 'OWNER' }),
        expect.objectContaining({ userId: maria, papel: 'CONTRIBUTOR' }),
      ]);
    });

    it('o membro também vê a lista', async () => {
      const id = await agendaDoEnzoCom(maria, 'VIEWER');

      expect(await agendas.membros(maria, id)).toHaveLength(2);
    });

    it('o dono muda o papel de um membro', async () => {
      const id = await agendaDoEnzoCom(maria, 'VIEWER');

      await agendas.definirPapel({
        userId: enzo,
        calendarId: id,
        membroId: maria,
        papel: 'EDITOR',
      });

      const { papel } = await acesso.abrir({
        calendarId: id,
        userId: maria,
        acao: 'ver',
      });
      expect(papel).toBe('EDITOR');
    });

    it('o membro não muda papel de ninguém', async () => {
      const id = await agendaDoEnzoCom(maria, 'EDITOR');

      await expect(
        agendas.definirPapel({
          userId: maria,
          calendarId: id,
          membroId: enzo,
          papel: 'VIEWER',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('o dono continua dono mesmo sem linha de membro', async () => {
      // `ownerId` é a fonte da verdade do papel de dono, e a linha de membro
      // existe para a lista. Os dois caminhos normalmente concordam, e é
      // justamente por isso que esta divergência precisa de teste: sem ele, a
      // afirmação de que o dono não se tranca fora da própria agenda não estava
      // verificada em lugar nenhum.
      const id = await agendaDoEnzoCom(maria, 'EDITOR');
      await prisma.calendarMember.deleteMany({
        where: { calendarId: id, userId: enzo },
      });

      const { papel } = await acesso.abrir({
        calendarId: id,
        userId: enzo,
        acao: 'excluir-agenda',
      });

      expect(papel).toBe('OWNER');
      expect((await agendas.listar(enzo)).map((a) => a.id)).toContain(id);
    });

    it('o dono não pode ser removido da própria agenda', async () => {
      const id = await agendaDoEnzoCom(maria, 'EDITOR');

      await expect(
        agendas.removerMembro({
          userId: enzo,
          calendarId: id,
          membroId: enzo,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('sair', () => {
    it('o VIEWER consegue sair — o papel mais restrito não é o mais preso', async () => {
      const id = await agendaDoEnzoCom(maria, 'VIEWER');

      await agendas.sair(maria, id);

      expect(await agendas.listar(maria)).toEqual([]);
      await expect(
        acesso.abrir({ calendarId: id, userId: maria, acao: 'ver' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('o dono não sai da própria agenda', async () => {
      const id = await agendaDoEnzoCom(maria, 'VIEWER');

      await expect(agendas.sair(enzo, id)).rejects.toThrow(ConflictException);
    });
  });

  // ─── apoio ───────────────────────────────────────────────────────────────

  async function agendaDoEnzoCom(
    convidado: string,
    papel: 'EDITOR' | 'CONTRIBUTOR' | 'VIEWER',
  ): Promise<string> {
    const agenda = await agendas.criar(enzo, {
      name: 'Compartilhada',
      kind: 'SHARED',
      color: '#6d7cff',
    });
    await virarMembro(prisma, agenda.id, convidado, papel);
    return agenda.id;
  }
});

async function criarUsuario(
  prisma: PrismaService,
  apelido: string,
): Promise<string> {
  const id = uuidv7();

  await prisma.user.create({
    data: {
      id,
      email: `${PREFIXO}-${apelido}@norbit.dev`,
      handle: `${PREFIXO.replace('-', '_')}_${apelido}`,
      displayName: apelido,
      settings: { create: {} },
    },
  });

  return id;
}

/**
 * Cria a linha de membro direto no banco.
 *
 * Entrar numa agenda é por convite, e o convite é do bloco de compartilhamento
 * do roadmap — ainda não existe rota. Inserir a linha aqui é o que permite
 * exercitar a matriz inteira antes disso.
 */
async function virarMembro(
  prisma: PrismaService,
  calendarId: string,
  userId: string,
  role: 'EDITOR' | 'CONTRIBUTOR' | 'VIEWER',
): Promise<void> {
  await prisma.calendarMember.create({ data: { calendarId, userId, role } });
}

async function limpar(prisma: PrismaService): Promise<void> {
  const usuarios = await prisma.user.findMany({
    where: { email: { startsWith: PREFIXO } },
    select: { id: true },
  });
  const ids = usuarios.map((u) => u.id);

  if (ids.length === 0) {
    return;
  }

  // As agendas saem antes dos usuários porque `Calendar.ownerId` é `Restrict`,
  // não `Cascade` — a mesma razão que tornava o seed quebrado na segunda
  // execução.
  await prisma.calendar.deleteMany({ where: { ownerId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

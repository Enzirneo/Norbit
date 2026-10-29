/**
 * Testes de integração das tarefas, contra o Postgres de verdade.
 *
 * A aritmética da ordenação já é testada como função pura em `libs/domain`, e
 * verificada por mutação. O que **estes** testes provam é o que só aparece com
 * banco: que a renumeração acontece na lista certa, que a subtarefa é ordenada
 * dentro da mãe, e que excluir uma tarefa não deixa subtarefa órfã.
 */
import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaModule, PrismaService } from '@norbit/db';
import type { TarefaVisivel } from '@norbit/contracts';
import { PASSO } from '@norbit/domain';
import { uuidv7 } from 'uuidv7';
import { AcessoService } from '../agendas/acesso.service';
import { AgendasService } from '../agendas/agendas.service';
import { PosicionamentoService } from './posicionamento.service';
import { TarefasService } from './tarefas.service';

const PREFIXO = 'teste-tarefas';
const SAO_PAULO = 'America/Sao_Paulo';

describe('TarefasService', () => {
  let modulo: TestingModule;
  let tarefas: TarefasService;
  let agendas: AgendasService;
  let prisma: PrismaService;

  let enzo: string;
  let maria: string;
  let agenda: string;

  beforeAll(async () => {
    modulo = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule],
      providers: [
        TarefasService,
        PosicionamentoService,
        AgendasService,
        AcessoService,
      ],
    }).compile();

    await modulo.init();

    tarefas = modulo.get(TarefasService);
    agendas = modulo.get(AgendasService);
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

    const criada = await agendas.criar(enzo, {
      name: 'Casa',
      kind: 'SHARED',
      color: '#6d7cff',
      timeZone: SAO_PAULO,
    });
    agenda = criada.id;
  });

  describe('criar', () => {
    it('entra no fim da lista', async () => {
      // Três, e não duas: com duas, pegar a **primeira** irmã em vez da última
      // dá a mesma resposta, e o teste não distinguiria as duas
      // implementações. A terceira é que separa — ela colidiria com a segunda.
      const primeira = await criar('Comprar pão');
      const segunda = await criar('Pagar a conta');
      const terceira = await criar('Levar o lixo');

      expect([primeira, segunda, terceira].map((t) => t.position)).toEqual([
        PASSO,
        PASSO * 2,
        PASSO * 3,
      ]);
    });

    it('nasce em aberto', async () => {
      expect((await criar('Comprar pão')).completedAt).toBeNull();
    });
  });

  describe('prazo de dia inteiro', () => {
    it('é guardado como fim exclusivo do dia, no fuso da agenda', async () => {
      // São Paulo é UTC-3: o dia 15 fecha às 03:00Z do dia 16. É isso que faz
      // "está atrasada" ser `dueAt <= agora`, sem ajuste nenhum.
      const tarefa = await criar('Entregar o relatório', {
        dueAt: new Date('2026-06-15T13:45:00Z'),
        isDueAllDay: true,
      });

      expect(tarefa.dueAt).toBe('2026-06-16T03:00:00.000Z');
    });

    it('não mexe no prazo com hora', async () => {
      const tarefa = await criar('Ligar para o médico', {
        dueAt: new Date('2026-06-15T13:45:00Z'),
      });

      expect(tarefa.dueAt).toBe('2026-06-15T13:45:00.000Z');
    });

    it('marcar como dia inteiro normaliza o prazo que já estava lá', async () => {
      // As duas coisas se afetam. Sem isto a tarefa ficaria marcada como "dia
      // inteiro" guardando 13:45, e a comparação de atraso erraria por horas.
      const tarefa = await criar('Entregar', {
        dueAt: new Date('2026-06-15T13:45:00Z'),
      });

      const alterada = await tarefas.atualizar({
        userId: enzo,
        taskId: tarefa.id,
        dados: { isDueAllDay: true },
      });

      expect(alterada.dueAt).toBe('2026-06-16T03:00:00.000Z');
    });

    it('um PATCH que não toca no prazo não o empurra', async () => {
      // A idempotência de `fimExclusivoDoDia` valendo na prática: sem ela, cada
      // salvamento adiaria a tarefa um dia.
      const tarefa = await criar('Entregar', {
        dueAt: new Date('2026-06-15T13:45:00Z'),
        isDueAllDay: true,
      });

      const uma = await tarefas.atualizar({
        userId: enzo,
        taskId: tarefa.id,
        dados: { isDueAllDay: true },
      });
      const duas = await tarefas.atualizar({
        userId: enzo,
        taskId: tarefa.id,
        dados: { isDueAllDay: true },
      });

      expect(uma.dueAt).toBe(tarefa.dueAt);
      expect(duas.dueAt).toBe(tarefa.dueAt);
    });
  });

  describe('concluir', () => {
    it('grava a data no servidor, não no cliente', async () => {
      const tarefa = await criar('Comprar pão');

      const concluida = await tarefas.atualizar({
        userId: enzo,
        taskId: tarefa.id,
        dados: { concluida: true },
      });

      expect(concluida.completedAt).not.toBeNull();
    });

    it('reabrir limpa a data', async () => {
      const tarefa = await criar('Comprar pão');
      await tarefas.atualizar({
        userId: enzo,
        taskId: tarefa.id,
        dados: { concluida: true },
      });

      const reaberta = await tarefas.atualizar({
        userId: enzo,
        taskId: tarefa.id,
        dados: { concluida: false },
      });

      expect(reaberta.completedAt).toBeNull();
    });

    it('sai da listagem padrão e volta quando pedida', async () => {
      const tarefa = await criar('Comprar pão');
      await criar('Pagar a conta');
      await tarefas.atualizar({
        userId: enzo,
        taskId: tarefa.id,
        dados: { concluida: true },
      });

      expect((await listar()).map((t) => t.title)).toEqual(['Pagar a conta']);
      expect(await listar({ incluirConcluidas: true })).toHaveLength(2);
    });
  });

  describe('reordenar', () => {
    it('move para o meio sem tocar nas outras', async () => {
      const a = await criar('A');
      const b = await criar('B');
      const c = await criar('C');

      // Arrasta C para entre A e B.
      const movida = await tarefas.mover({
        userId: enzo,
        taskId: c.id,
        dados: { anteriorId: a.id, proximaId: b.id },
      });

      expect(movida.position).toBeGreaterThan(a.position);
      expect(movida.position).toBeLessThan(b.position);
      expect((await listar()).map((t) => t.title)).toEqual(['A', 'C', 'B']);

      // As outras duas não foram escritas: é a razão de a posição ser Float.
      const depois = await listar();
      expect(depois.find((t) => t.title === 'A')?.position).toBe(a.position);
      expect(depois.find((t) => t.title === 'B')?.position).toBe(b.position);
    });

    it('move para o topo e para o fim', async () => {
      const a = await criar('A');
      const b = await criar('B');

      await tarefas.mover({
        userId: enzo,
        taskId: b.id,
        dados: { anteriorId: null, proximaId: a.id },
      });
      expect((await listar()).map((t) => t.title)).toEqual(['B', 'A']);

      await tarefas.mover({
        userId: enzo,
        taskId: b.id,
        dados: { anteriorId: a.id, proximaId: null },
      });
      expect((await listar()).map((t) => t.title)).toEqual(['A', 'B']);
    });

    it('renumera quando o espaço entre os vizinhos acaba', async () => {
      // O caso que o comentário do schema não cobre: arrastar sempre para a
      // mesma fenda esgota o double. Aqui o espaço é forçado a zero de uma vez,
      // escrevendo duas posições adjacentes direto no banco.
      const a = await criar('A');
      const b = await criar('B');
      const c = await criar('C');

      await prisma.task.update({ where: { id: a.id }, data: { position: 1 } });
      await prisma.task.update({
        where: { id: b.id },
        data: { position: 1 + Number.EPSILON },
      });

      const movida = await tarefas.mover({
        userId: enzo,
        taskId: c.id,
        dados: { anteriorId: a.id, proximaId: b.id },
      });

      // A ordem pedida vale, e as posições voltaram a ter espaço entre si.
      const lista = await listar();
      expect(lista.map((t) => t.title)).toEqual(['A', 'C', 'B']);
      expect(lista.map((t) => t.position)).toEqual([
        PASSO,
        PASSO * 2,
        PASSO * 3,
      ]);
      expect(movida.position).toBe(PASSO * 2);
    });

    it('recusa vizinho que não é da mesma lista', async () => {
      // Aceitar faria a tarefa receber uma posição calculada contra outra
      // lista, e ela apareceria em lugar nenhum previsível.
      const outra = await agendas.criar(enzo, {
        name: 'Trabalho',
        kind: 'PERSONAL',
        color: '#6d7cff',
      });
      const aqui = await criar('Aqui');
      const la = await tarefas.criar({
        userId: enzo,
        calendarId: outra.id,
        dados: {
          title: 'Lá',
          priority: 'NONE',
          isDueAllDay: false,
          visibility: 'INHERITED',
        },
      });

      await expect(
        tarefas.mover({
          userId: enzo,
          taskId: aqui.id,
          dados: { anteriorId: la.id, proximaId: null },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('recusa vizinhos que não são adjacentes nesta ordem', async () => {
      const a = await criar('A');
      const b = await criar('B');
      const c = await criar('C');

      await expect(
        tarefas.mover({
          userId: enzo,
          taskId: c.id,
          dados: { anteriorId: b.id, proximaId: a.id },
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('subtarefas', () => {
    it('são ordenadas dentro da mãe, não na lista de cima', async () => {
      // Se a subtarefa entrasse na numeração geral, arrastá-la mexeria na ordem
      // das tarefas principais.
      const mae = await criar('Mudança');
      const filha = await criar('Caixas', { parentTaskId: mae.id });
      const outraPrincipal = await criar('Pagar a conta');

      expect(filha.position).toBe(PASSO);
      expect(mae.position).toBe(PASSO);
      expect(outraPrincipal.position).toBe(PASSO * 2);
    });

    it('reordenar uma subtarefa não mexe na lista de cima', async () => {
      // O outro lado do isolamento: `noFim` já respeita a mãe (a criação prova
      // isso), mas **mover** precisa buscar as irmãs dentro da mãe também. Sem
      // este teste, uma consulta de irmãs sem o filtro de mãe passava verde.
      const mae = await criar('Mudança');
      const outraPrincipal = await criar('Pagar a conta');
      const caixas = await criar('Caixas', { parentTaskId: mae.id });
      const fita = await criar('Fita', { parentTaskId: mae.id });

      await tarefas.mover({
        userId: enzo,
        taskId: fita.id,
        dados: { anteriorId: null, proximaId: caixas.id },
      });

      const lista = await listar();
      const subtarefas = lista.filter((t) => t.parentTaskId === mae.id);
      const principais = lista.filter((t) => t.parentTaskId === null);

      expect(subtarefas.map((t) => t.title)).toEqual(['Fita', 'Caixas']);
      // As principais não foram tocadas, e continuam na ordem original.
      expect(principais.map((t) => t.title)).toEqual([
        'Mudança',
        'Pagar a conta',
      ]);
      expect(principais.map((t) => t.position)).toEqual([
        mae.position,
        outraPrincipal.position,
      ]);
    });

    it('recusa uma tarefa principal como vizinha de uma subtarefa', async () => {
      // O que o filtro de mãe realmente protege. Sem ele, a ordem final do
      // teste acima ainda saía certa por acidente — mas a validação de "o
      // vizinho é da mesma lista" deixava de valer entre níveis, e a subtarefa
      // recebia uma posição calculada contra a lista de cima.
      const mae = await criar('Mudança');
      const principal = await criar('Pagar a conta');
      const caixas = await criar('Caixas', { parentTaskId: mae.id });

      await expect(
        tarefas.mover({
          userId: enzo,
          taskId: caixas.id,
          dados: { anteriorId: principal.id, proximaId: null },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('vão até um nível', async () => {
      const mae = await criar('Mudança');
      const filha = await criar('Caixas', { parentTaskId: mae.id });

      await expect(
        criar('Fita adesiva', { parentTaskId: filha.id }),
      ).rejects.toThrow(BadRequestException);
    });

    it('uma tarefa com subtarefas não pode virar subtarefa', async () => {
      // O outro lado do limite: permitir empurraria as filhas para o segundo
      // nível por via indireta, sem passar por validação nenhuma.
      const mae = await criar('Mudança');
      await criar('Caixas', { parentTaskId: mae.id });
      const outra = await criar('Pagar a conta');

      await expect(
        tarefas.atualizar({
          userId: enzo,
          taskId: mae.id,
          dados: { parentTaskId: outra.id },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('uma tarefa não pode ser subtarefa de si mesma', async () => {
      const tarefa = await criar('Mudança');

      await expect(
        tarefas.atualizar({
          userId: enzo,
          taskId: tarefa.id,
          dados: { parentTaskId: tarefa.id },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('recusa mãe de outra agenda', async () => {
      const outra = await agendas.criar(enzo, {
        name: 'Trabalho',
        kind: 'PERSONAL',
        color: '#6d7cff',
      });
      const la = await tarefas.criar({
        userId: enzo,
        calendarId: outra.id,
        dados: {
          title: 'Lá',
          priority: 'NONE',
          isDueAllDay: false,
          visibility: 'INHERITED',
        },
      });

      await expect(criar('Aqui', { parentTaskId: la.id })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('excluir a mãe leva as filhas, sem deixar órfã na listagem', async () => {
      // O `onDelete: Cascade` do banco só vale para exclusão física. Sem levar
      // as filhas, elas ficariam na lista apontando para uma mãe invisível.
      const mae = await criar('Mudança');
      await criar('Caixas', { parentTaskId: mae.id });
      await criar('Fita', { parentTaskId: mae.id });
      await criar('Pagar a conta');

      await tarefas.remover(enzo, mae.id);

      expect((await listar()).map((t) => t.title)).toEqual(['Pagar a conta']);
    });
  });

  describe('responsável', () => {
    it('aceita um membro da agenda', async () => {
      await prisma.calendarMember.create({
        data: { calendarId: agenda, userId: maria, role: 'CONTRIBUTOR' },
      });

      const tarefa = await criar('Comprar pão', { assigneeId: maria });

      expect(tarefa.assigneeId).toBe(maria);
    });

    it('aceita o dono', async () => {
      expect(
        (await criar('Comprar pão', { assigneeId: enzo })).assigneeId,
      ).toBe(enzo);
    });

    it('recusa quem não é membro', async () => {
      // Atribuir a quem não vê a agenda cria uma tarefa que o responsável nunca
      // encontra — e quem atribuiu acha que delegou.
      await expect(criar('Comprar pão', { assigneeId: maria })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('filtra a listagem por responsável', async () => {
      await prisma.calendarMember.create({
        data: { calendarId: agenda, userId: maria, role: 'CONTRIBUTOR' },
      });
      await criar('Da Maria', { assigneeId: maria });
      await criar('De ninguém');

      const dela = await listar({ responsavelId: maria });

      expect(dela.map((t) => t.title)).toEqual(['Da Maria']);
    });
  });

  describe('a permissão valendo no caminho do banco', () => {
    it('o VIEWER não cria tarefa', async () => {
      await prisma.calendarMember.create({
        data: { calendarId: agenda, userId: maria, role: 'VIEWER' },
      });

      await expect(
        tarefas.criar({
          userId: maria,
          calendarId: agenda,
          dados: {
            title: 'Não vai',
            priority: 'NONE',
            isDueAllDay: false,
            visibility: 'INHERITED',
          },
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('o CONTRIBUTOR não conclui a tarefa de outra pessoa', async () => {
      await prisma.calendarMember.create({
        data: { calendarId: agenda, userId: maria, role: 'CONTRIBUTOR' },
      });
      const doEnzo = await criar('Do Enzo');

      await expect(
        tarefas.atualizar({
          userId: maria,
          taskId: doEnzo.id,
          dados: { concluida: true },
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('o EDITOR conclui a tarefa de outra pessoa', async () => {
      await prisma.calendarMember.create({
        data: { calendarId: agenda, userId: maria, role: 'EDITOR' },
      });
      const doEnzo = await criar('Do Enzo');

      const concluida = await tarefas.atualizar({
        userId: maria,
        taskId: doEnzo.id,
        dados: { concluida: true },
      });

      expect(concluida.completedAt).not.toBeNull();
    });

    it('a tarefa privada não aparece para os outros', async () => {
      await prisma.calendarMember.create({
        data: { calendarId: agenda, userId: maria, role: 'EDITOR' },
      });
      await criar('Terapia', { visibility: 'PRIVATE' });

      const paraMaria = await tarefas.listar(maria, {
        incluirConcluidas: false,
      });

      expect(paraMaria).toEqual([]);
    });

    it('a listagem não traz tarefa de agenda que eu não vejo', async () => {
      await criar('Privada por filiação');

      expect(await tarefas.listar(maria, { incluirConcluidas: false })).toEqual(
        [],
      );
    });
  });

  // ─── apoio ───────────────────────────────────────────────────────────────

  type Campos = {
    dueAt?: Date;
    isDueAllDay?: boolean;
    parentTaskId?: string;
    assigneeId?: string;
    visibility?: 'INHERITED' | 'PRIVATE';
  };

  function criar(title: string, campos: Campos = {}): Promise<TarefaVisivel> {
    return tarefas.criar({
      userId: enzo,
      calendarId: agenda,
      dados: {
        title,
        priority: 'NONE',
        isDueAllDay: campos.isDueAllDay ?? false,
        visibility: campos.visibility ?? 'INHERITED',
        dueAt: campos.dueAt,
        parentTaskId: campos.parentTaskId,
        assigneeId: campos.assigneeId,
      },
    });
  }

  function listar(
    consulta: { incluirConcluidas?: boolean; responsavelId?: string } = {},
  ): Promise<TarefaVisivel[]> {
    return tarefas.listar(enzo, {
      incluirConcluidas: consulta.incluirConcluidas ?? false,
      responsavelId: consulta.responsavelId,
    });
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

async function limpar(prisma: PrismaService): Promise<void> {
  const usuarios = await prisma.user.findMany({
    where: { email: { startsWith: PREFIXO } },
    select: { id: true },
  });
  const ids = usuarios.map((u) => u.id);

  if (ids.length === 0) {
    return;
  }

  await prisma.calendar.deleteMany({ where: { ownerId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

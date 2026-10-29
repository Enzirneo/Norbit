/**
 * Testes de integração dos eventos, contra o Postgres de verdade.
 *
 * A expansão de recorrência já é testada como função pura em `libs/domain`, com
 * 26 casos e verificada por mutação. O que **estes** testes provam é o que só
 * aparece com banco no meio: que o pré-filtro do Postgres não descarta uma série
 * que tem ocorrência no intervalo, que as exceções de cada série chegam à
 * expansão, e que "editar só este" não faz o evento aparecer duas vezes.
 */
import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type {
  CriarEvento,
  EventoVisivel,
  OcorrenciaVisivel,
} from '@norbit/contracts';
import { PrismaModule, PrismaService } from '@norbit/db';
import { uuidv7 } from 'uuidv7';
import { AcessoService } from '../agendas/acesso.service';
import { AgendasService } from '../agendas/agendas.service';
import { EventosService } from './eventos.service';

const PREFIXO = 'teste-eventos';
const SAO_PAULO = 'America/Sao_Paulo';
const NOVA_YORK = 'America/New_York';

describe('EventosService', () => {
  let modulo: TestingModule;
  let eventos: EventosService;
  let agendas: AgendasService;
  let prisma: PrismaService;

  let enzo: string;
  let maria: string;
  let agenda: string;

  beforeAll(async () => {
    modulo = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule],
      providers: [EventosService, AgendasService, AcessoService],
    }).compile();

    await modulo.init();

    eventos = modulo.get(EventosService);
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
      name: 'Compartilhada',
      kind: 'SHARED',
      color: '#6d7cff',
      timeZone: SAO_PAULO,
    });
    agenda = criada.id;
  });

  describe('evento avulso', () => {
    it('aparece na consulta do intervalo', async () => {
      await criar({
        title: 'Jantar',
        startsAt: new Date('2026-06-15T22:00:00Z'),
        endsAt: new Date('2026-06-15T23:00:00Z'),
      });

      const r = await consultar('2026-06-01T00:00:00Z', '2026-07-01T00:00:00Z');

      expect(r.map((o) => o.title)).toEqual(['Jantar']);
      expect(r[0]?.ehRecorrente).toBe(false);
    });

    it('não aparece fora do intervalo', async () => {
      await criar({
        title: 'Fora',
        startsAt: new Date('2026-08-15T22:00:00Z'),
        endsAt: new Date('2026-08-15T23:00:00Z'),
      });

      expect(
        await consultar('2026-06-01T00:00:00Z', '2026-07-01T00:00:00Z'),
      ).toEqual([]);
    });

    it('herda o fuso da agenda quando nenhum é informado', async () => {
      const criado = await criar({
        title: 'Sem fuso',
        startsAt: new Date('2026-06-15T22:00:00Z'),
        endsAt: new Date('2026-06-15T23:00:00Z'),
      });

      expect(criado.timeZone).toBe(SAO_PAULO);
    });
  });

  describe('dia inteiro', () => {
    it('é gravado de meia-noite a meia-noite local, com o fim exclusivo', async () => {
      const criado = await criar({
        title: 'Feriado',
        startsAt: new Date('2026-06-15T13:45:00Z'),
        endsAt: new Date('2026-06-15T18:20:00Z'),
        isAllDay: true,
      });

      // São Paulo é UTC-3: meia-noite local do dia 15 é 03:00Z do dia 15.
      expect(criado.startsAt).toBe('2026-06-15T03:00:00.000Z');
      expect(criado.endsAt).toBe('2026-06-16T03:00:00.000Z');
    });

    it('não vaza para a visão do dia seguinte', async () => {
      // O a-menos que o fim exclusivo expôs: com a borda de baixo inclusiva, o
      // dia inteiro do dia 15 aparecia também no dia 16, porque termina
      // exatamente na meia-noite que abre o 16.
      await criar({
        title: 'Feriado',
        startsAt: new Date('2026-06-15T13:45:00Z'),
        endsAt: new Date('2026-06-15T18:20:00Z'),
        isAllDay: true,
      });

      const dia15 = await consultar(
        '2026-06-15T03:00:00Z',
        '2026-06-16T03:00:00Z',
      );
      const dia16 = await consultar(
        '2026-06-16T03:00:00Z',
        '2026-06-17T03:00:00Z',
      );

      expect(dia15.map((o) => o.title)).toEqual(['Feriado']);
      expect(dia16).toEqual([]);
    });
  });

  describe('série recorrente', () => {
    it('vira uma linha no banco e muitas ocorrências na consulta', async () => {
      await criar({
        title: 'Terapia',
        startsAt: new Date('2026-06-02T12:00:00Z'), // terça
        endsAt: new Date('2026-06-02T13:00:00Z'),
        recurrenceRule: 'FREQ=WEEKLY;BYDAY=TU',
      });

      const linhas = await prisma.event.count({
        where: { calendarId: agenda },
      });
      const r = await consultar('2026-06-01T00:00:00Z', '2026-07-01T00:00:00Z');

      expect(linhas).toBe(1);
      expect(r).toHaveLength(5);
      expect(r.every((o) => o.ehRecorrente)).toBe(true);
    });

    it('mantém a hora local atravessando a virada de horário de verão', async () => {
      // "Toda quarta às 9h" em Nova York, cruzando 1º de novembro de 2026.
      // Antes da virada 9h locais são 13h UTC; depois, 14h UTC. Uma expansão
      // feita em UTC manteria 13h e o evento passaria a acontecer às 8h.
      await criar({
        title: 'Reunião',
        startsAt: new Date('2026-10-28T13:00:00Z'),
        endsAt: new Date('2026-10-28T14:00:00Z'),
        timeZone: NOVA_YORK,
        recurrenceRule: 'FREQ=WEEKLY;BYDAY=WE',
      });

      const r = await consultar('2026-10-25T00:00:00Z', '2026-11-15T00:00:00Z');

      expect(r.map((o) => o.inicio)).toEqual([
        '2026-10-28T13:00:00.000Z',
        '2026-11-04T14:00:00.000Z',
        '2026-11-11T14:00:00.000Z',
      ]);
    });

    it('a série que começou antes do intervalo é encontrada pelo pré-filtro', async () => {
      // O defeito que este teste pega não está na expansão: está no `where`. Um
      // filtro por `startsAt` dentro do intervalo descartaria a linha antes de
      // expandir, e a série sumiria das visões seguintes.
      await criar({
        title: 'Antiga',
        startsAt: new Date('2024-01-02T12:00:00Z'),
        endsAt: new Date('2024-01-02T13:00:00Z'),
        recurrenceRule: 'FREQ=WEEKLY;BYDAY=TU',
      });

      const r = await consultar('2026-06-01T00:00:00Z', '2026-07-01T00:00:00Z');

      expect(r).toHaveLength(5);
    });

    it('a série encerrada antes do intervalo é descartada', async () => {
      await criar({
        title: 'Encerrada',
        startsAt: new Date('2024-01-02T12:00:00Z'),
        endsAt: new Date('2024-01-02T13:00:00Z'),
        recurrenceRule: 'FREQ=WEEKLY;BYDAY=TU;UNTIL=20240301T000000Z',
      });

      expect(
        await consultar('2026-06-01T00:00:00Z', '2026-07-01T00:00:00Z'),
      ).toEqual([]);
    });

    it('recusa a regra que o Norbit não implementa, e não grava nada', async () => {
      // Ignorar a parte não suportada geraria ocorrências diferentes das
      // pedidas, sem nada no log. Pior: a regra entraria no banco e toda
      // consulta daquela agenda passaria a quebrar, para todos os membros.
      await expect(
        criar({
          title: 'Complicada',
          startsAt: new Date('2026-06-02T12:00:00Z'),
          endsAt: new Date('2026-06-02T13:00:00Z'),
          recurrenceRule: 'FREQ=MONTHLY;BYDAY=TU;BYSETPOS=2',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(await prisma.event.count({ where: { calendarId: agenda } })).toBe(
        0,
      );
    });

    it('guarda o UNTIL desnormalizado, para o índice poder usá-lo', async () => {
      const criado = await criar({
        title: 'Com fim',
        startsAt: new Date('2026-06-02T12:00:00Z'),
        endsAt: new Date('2026-06-02T13:00:00Z'),
        recurrenceRule: 'FREQ=WEEKLY;BYDAY=TU;UNTIL=20260801T000000Z',
      });

      const linha = await prisma.event.findUniqueOrThrow({
        where: { id: criado.id },
      });
      expect(linha.recurrenceUntil?.toISOString()).toBe(
        '2026-08-01T00:00:00.000Z',
      );
    });
  });

  describe('as três operações de uma série', () => {
    async function serieSemanal(): Promise<string> {
      const criado = await criar({
        title: 'Terapia',
        startsAt: new Date('2026-06-02T12:00:00Z'),
        endsAt: new Date('2026-06-02T13:00:00Z'),
        recurrenceRule: 'FREQ=WEEKLY;BYDAY=TU',
      });
      return criado.id;
    }

    const JUNHO = ['2026-06-01T00:00:00Z', '2026-07-01T00:00:00Z'] as const;

    it('editar todos: altera a linha-mãe e todas as ocorrências', async () => {
      const id = await serieSemanal();

      await eventos.atualizar({
        userId: enzo,
        eventId: id,
        dados: { title: 'Terapia (novo horário)' },
      });

      const r = await consultar(...JUNHO);
      expect(r).toHaveLength(5);
      expect(new Set(r.map((o) => o.title))).toEqual(
        new Set(['Terapia (novo horário)']),
      );
    });

    it('excluir só este: a ocorrência sai, as outras ficam', async () => {
      const id = await serieSemanal();

      await eventos.excluirOcorrencia({
        userId: enzo,
        eventId: id,
        inicioOriginal: new Date('2026-06-09T12:00:00Z'),
      });

      const r = await consultar(...JUNHO);
      expect(r.map((o) => o.inicio)).not.toContain('2026-06-09T12:00:00.000Z');
      expect(r).toHaveLength(4);
    });

    it('excluir só este é idempotente', async () => {
      const id = await serieSemanal();
      const alvo = {
        userId: enzo,
        eventId: id,
        inicioOriginal: new Date('2026-06-09T12:00:00Z'),
      };

      await eventos.excluirOcorrencia(alvo);
      await eventos.excluirOcorrencia(alvo);

      const linha = await prisma.event.findUniqueOrThrow({ where: { id } });
      // Sem a verificação, a mesma data entraria duas vezes no array — o
      // resultado da consulta seria o mesmo e o defeito só apareceria no
      // tamanho da coluna, meses depois.
      expect(linha.excludedDates).toHaveLength(1);
    });

    it('editar só este: cria a filha e a ocorrência não aparece duas vezes', async () => {
      const id = await serieSemanal();

      const filha = await eventos.destacarOcorrencia({
        userId: enzo,
        eventId: id,
        inicioOriginal: new Date('2026-06-09T12:00:00Z'),
      });

      expect(filha.recurrenceParentId).toBe(id);
      expect(filha.originalStartsAt).toBe('2026-06-09T12:00:00.000Z');
      expect(filha.recurrenceRule).toBeNull();

      const r = await consultar(...JUNHO);
      // Cinco ocorrências, não seis: a instância original é suprimida pela
      // existência da filha. É o defeito mais visível desta parte — o evento
      // duplicado na tela.
      expect(r).toHaveLength(5);
      expect(
        r.filter((o) => o.inicio === '2026-06-09T12:00:00.000Z'),
      ).toHaveLength(1);
    });

    it('a filha movida para outra data continua suprimindo a original', async () => {
      const id = await serieSemanal();
      const filha = await eventos.destacarOcorrencia({
        userId: enzo,
        eventId: id,
        inicioOriginal: new Date('2026-06-09T12:00:00Z'),
      });

      await eventos.atualizar({
        userId: enzo,
        eventId: filha.id,
        dados: {
          startsAt: new Date('2026-09-09T12:00:00Z'),
          endsAt: new Date('2026-09-09T13:00:00Z'),
        },
      });

      const r = await consultar(...JUNHO);
      // Quatro: as cinco terças de junho menos a que foi movida para setembro.
      // A busca das exceções é por `recurrenceParentId`, não pelo intervalo —
      // uma filha fora da janela precisa continuar suprimindo.
      expect(r.map((o) => o.inicio)).not.toContain('2026-06-09T12:00:00.000Z');
      expect(r).toHaveLength(4);
    });

    it('apagar a filha não ressuscita a ocorrência original', async () => {
      const id = await serieSemanal();
      const filha = await eventos.destacarOcorrencia({
        userId: enzo,
        eventId: id,
        inicioOriginal: new Date('2026-06-09T12:00:00Z'),
      });

      await eventos.remover(enzo, filha.id);

      const r = await consultar(...JUNHO);
      expect(r).toHaveLength(4);
    });

    it('recusa destacar uma data que a regra nunca geraria', async () => {
      // Uma filha numa data fora da série seria uma linha que a expansão jamais
      // suprimiria: um evento fantasma, sem como ser encontrado pela série.
      const id = await serieSemanal();

      await expect(
        eventos.destacarOcorrencia({
          userId: enzo,
          eventId: id,
          inicioOriginal: new Date('2026-06-10T12:00:00Z'), // quarta
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('recusa destacar num evento que não é série', async () => {
      const avulso = await criar({
        title: 'Avulso',
        startsAt: new Date('2026-06-02T12:00:00Z'),
        endsAt: new Date('2026-06-02T13:00:00Z'),
      });

      await expect(
        eventos.destacarOcorrencia({
          userId: enzo,
          eventId: avulso.id,
          inicioOriginal: new Date('2026-06-02T12:00:00Z'),
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('a permissão valendo no caminho do banco', () => {
    it('o CONTRIBUTOR cria o próprio evento', async () => {
      await virarMembro(prisma, agenda, maria, 'CONTRIBUTOR');

      const criado = await eventos.criar({
        userId: maria,
        calendarId: agenda,
        dados: evento({
          title: 'Da Maria',
          startsAt: new Date('2026-06-15T12:00:00Z'),
          endsAt: new Date('2026-06-15T13:00:00Z'),
        }),
      });

      expect(criado.createdById).toBe(maria);
    });

    it('o CONTRIBUTOR não edita o evento de outra pessoa', async () => {
      await virarMembro(prisma, agenda, maria, 'CONTRIBUTOR');
      const doEnzo = await criar({
        title: 'Do Enzo',
        startsAt: new Date('2026-06-15T12:00:00Z'),
        endsAt: new Date('2026-06-15T13:00:00Z'),
      });

      await expect(
        eventos.atualizar({
          userId: maria,
          eventId: doEnzo.id,
          dados: { title: 'Sequestrado' },
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('o EDITOR edita o evento de outra pessoa', async () => {
      await virarMembro(prisma, agenda, maria, 'EDITOR');
      const doEnzo = await criar({
        title: 'Do Enzo',
        startsAt: new Date('2026-06-15T12:00:00Z'),
        endsAt: new Date('2026-06-15T13:00:00Z'),
      });

      const alterado = await eventos.atualizar({
        userId: maria,
        eventId: doEnzo.id,
        dados: { title: 'Ajustado pela Maria' },
      });

      expect(alterado.title).toBe('Ajustado pela Maria');
    });

    it('o VIEWER não cria evento', async () => {
      await virarMembro(prisma, agenda, maria, 'VIEWER');

      await expect(
        eventos.criar({
          userId: maria,
          calendarId: agenda,
          dados: evento({
            title: 'Não vai',
            startsAt: new Date('2026-06-15T12:00:00Z'),
            endsAt: new Date('2026-06-15T13:00:00Z'),
          }),
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    describe('visibilidade PRIVATE', () => {
      it('o evento privado de um membro não aparece para os outros', async () => {
        await virarMembro(prisma, agenda, maria, 'EDITOR');
        await eventos.criar({
          userId: enzo,
          calendarId: agenda,
          dados: {
            ...evento({
              title: 'Consulta médica',
              startsAt: new Date('2026-06-15T12:00:00Z'),
              endsAt: new Date('2026-06-15T13:00:00Z'),
            }),
            visibility: 'PRIVATE',
          },
        });

        const paraMaria = await eventos.consultar(maria, {
          de: new Date('2026-06-01T00:00:00Z'),
          ate: new Date('2026-07-01T00:00:00Z'),
          agendas: undefined,
        });

        // A Maria é EDITOR: ela mexe em qualquer evento da agenda. Privacidade
        // não é papel — nem o EDITOR vê o que foi marcado como privado.
        expect(paraMaria).toEqual([]);
      });

      it('quem criou continua vendo o próprio evento privado', async () => {
        await eventos.criar({
          userId: enzo,
          calendarId: agenda,
          dados: {
            ...evento({
              title: 'Consulta médica',
              startsAt: new Date('2026-06-15T12:00:00Z'),
              endsAt: new Date('2026-06-15T13:00:00Z'),
            }),
            visibility: 'PRIVATE',
          },
        });

        const r = await consultar(
          '2026-06-01T00:00:00Z',
          '2026-07-01T00:00:00Z',
        );

        expect(r.map((o) => o.title)).toEqual(['Consulta médica']);
      });
    });

    it('a consulta não traz evento de agenda que eu não vejo', async () => {
      await criar({
        title: 'Privado',
        startsAt: new Date('2026-06-15T12:00:00Z'),
        endsAt: new Date('2026-06-15T13:00:00Z'),
      });

      const r = await eventos.consultar(maria, {
        de: new Date('2026-06-01T00:00:00Z'),
        ate: new Date('2026-07-01T00:00:00Z'),
        agendas: undefined,
      });

      expect(r).toEqual([]);
    });

    it('agenda pedida que eu não vejo é ignorada, não recusada', async () => {
      // Recusar confirmaria que aquele identificador existe, e a tela de
      // calendário não tem o que fazer com esse erro.
      const r = await eventos.consultar(maria, {
        de: new Date('2026-06-01T00:00:00Z'),
        ate: new Date('2026-07-01T00:00:00Z'),
        agendas: [agenda],
      });

      expect(r).toEqual([]);
    });
  });

  describe('porId', () => {
    it('devolve a linha gravada, com a regra de recorrência', async () => {
      const criado = await criar({
        title: 'Terapia',
        startsAt: new Date('2026-06-02T12:00:00Z'),
        endsAt: new Date('2026-06-02T13:00:00Z'),
        recurrenceRule: 'FREQ=WEEKLY;BYDAY=TU',
      });

      const lido = await eventos.porId(enzo, criado.id);

      expect(lido.recurrenceRule).toBe('FREQ=WEEKLY;BYDAY=TU');
      expect(lido.visibility).toBe('INHERITED');
    });

    it('um membro qualquer consegue ler', async () => {
      await virarMembro(prisma, agenda, maria, 'VIEWER');
      const criado = await criar({
        title: 'Do Enzo',
        startsAt: new Date('2026-06-15T12:00:00Z'),
        endsAt: new Date('2026-06-15T13:00:00Z'),
      });

      expect((await eventos.porId(maria, criado.id)).title).toBe('Do Enzo');
    });

    it('não é a porta de entrada para o que a consulta esconde', async () => {
      // Sem esta verificação, a rota por id devolveria o evento privado que a
      // listagem filtra — e a privacidade valeria só na tela de calendário.
      await virarMembro(prisma, agenda, maria, 'EDITOR');
      const privado = await eventos.criar({
        userId: enzo,
        calendarId: agenda,
        dados: {
          ...evento({
            title: 'Consulta médica',
            startsAt: new Date('2026-06-15T12:00:00Z'),
            endsAt: new Date('2026-06-15T13:00:00Z'),
          }),
          visibility: 'PRIVATE',
        },
      });

      await expect(eventos.porId(maria, privado.id)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('evento de agenda que eu não vejo dá o mesmo 404', async () => {
      const criado = await criar({
        title: 'Do Enzo',
        startsAt: new Date('2026-06-15T12:00:00Z'),
        endsAt: new Date('2026-06-15T13:00:00Z'),
      });

      await expect(eventos.porId(maria, criado.id)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('atualizar', () => {
    it('recusa mover só o fim para antes do início gravado', async () => {
      // O schema não consegue pegar isto: sem a linha gravada não há com o que
      // comparar. É o complemento prometido em `atualizarEventoSchema`.
      const criado = await criar({
        title: 'Jantar',
        startsAt: new Date('2026-06-15T22:00:00Z'),
        endsAt: new Date('2026-06-15T23:00:00Z'),
      });

      await expect(
        eventos.atualizar({
          userId: enzo,
          eventId: criado.id,
          dados: { endsAt: new Date('2026-06-15T21:00:00Z') },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('tirar a regra transforma a série num evento avulso', async () => {
      const criado = await criar({
        title: 'Terapia',
        startsAt: new Date('2026-06-02T12:00:00Z'),
        endsAt: new Date('2026-06-02T13:00:00Z'),
        recurrenceRule: 'FREQ=WEEKLY;BYDAY=TU;UNTIL=20260801T000000Z',
      });

      await eventos.atualizar({
        userId: enzo,
        eventId: criado.id,
        dados: { recurrenceRule: null },
      });

      const r = await consultar('2026-06-01T00:00:00Z', '2026-07-01T00:00:00Z');
      expect(r).toHaveLength(1);

      // O `UNTIL` desnormalizado tem de sair junto, ou o índice continuaria
      // acreditando numa série que não existe mais.
      const linha = await prisma.event.findUniqueOrThrow({
        where: { id: criado.id },
      });
      expect(linha.recurrenceUntil).toBeNull();
    });
  });

  // ─── apoio ───────────────────────────────────────────────────────────────

  type Campos = {
    title: string;
    startsAt: Date;
    endsAt: Date;
    isAllDay?: boolean;
    timeZone?: string;
    recurrenceRule?: string;
  };

  function evento(campos: Campos): CriarEvento {
    return {
      ...campos,
      isAllDay: campos.isAllDay ?? false,
      status: 'CONFIRMED',
      visibility: 'INHERITED',
    };
  }

  function criar(campos: Campos): Promise<EventoVisivel> {
    return eventos.criar({
      userId: enzo,
      calendarId: agenda,
      dados: evento(campos),
    });
  }

  function consultar(de: string, ate: string): Promise<OcorrenciaVisivel[]> {
    return eventos.consultar(enzo, {
      de: new Date(de),
      ate: new Date(ate),
      agendas: undefined,
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

  await prisma.calendar.deleteMany({ where: { ownerId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

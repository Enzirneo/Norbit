/**
 * Dados de desenvolvimento.
 *
 * Cria o cenário que a interface precisa exercitar desde o início: duas pessoas,
 * uma agenda pessoal para cada, uma agenda compartilhada entre as duas com
 * papéis diferentes, e eventos que cobrem os casos difíceis — recorrente, dia
 * inteiro e privado. Sem isso, cada reset do banco exigiria cadastrar tudo à mão.
 *
 * Uso: npm run db:seed
 */
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@norbit/db';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

/** Hash fixo da senha "norbit123", só para desenvolvimento. */
const SENHA_DEV = '$argon2id$v=19$m=65536,t=3,p=4$DESENVOLVIMENTO$seed';

const FUSO = 'America/Sao_Paulo';

const EMAIL_ENZO = 'enzo@norbit.dev';
const EMAIL_MARIA = 'maria@norbit.dev';

/** Data local em São Paulo, para os eventos caírem em horários plausíveis. */
function em(diasAFrente: number, hora: number, minuto = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + diasAFrente);
  d.setHours(hora, minuto, 0, 0);
  return d;
}

async function main(): Promise<void> {
  // Limpeza em duas etapas, e a ordem importa.
  //
  // `Calendar.ownerId` é `Restrict`, não `Cascade`: apagar um usuário com
  // agendas **falha**, de propósito, porque uma agenda compartilhada pertence
  // ao grupo e não só a quem a criou — perdê-la junto com a conta do dono seria
  // destruição silenciosa de dado alheio. Então as agendas saem primeiro,
  // levando por cascade eventos, tarefas, vínculos, convites e atividade.
  //
  // Sem isto o seed só funciona em banco vazio: na segunda execução ele morre
  // com P2003 em `calendars_ownerId_fkey`.
  const existentes = await prisma.user.findMany({
    where: { email: { in: [EMAIL_ENZO, EMAIL_MARIA] } },
    select: { id: true },
  });
  const idsExistentes = existentes.map((u) => u.id);

  if (idsExistentes.length > 0) {
    await prisma.calendar.deleteMany({
      where: { ownerId: { in: idsExistentes } },
    });
    await prisma.user.deleteMany({ where: { id: { in: idsExistentes } } });
  }

  const enzoId = randomUUID();
  const mariaId = randomUUID();

  const enzo = await prisma.user.create({
    data: {
      id: enzoId,
      email: EMAIL_ENZO,
      handle: 'enzo',
      displayName: 'Enzo',
      passwordHash: SENHA_DEV,
      timeZone: FUSO,
      emailVerifiedAt: new Date(),
      settings: { create: { themePreset: 'nebula', accentColor: '#6d7cff' } },
      ownedCalendars: {
        create: {
          id: randomUUID(),
          name: 'Minha órbita',
          kind: 'PERSONAL',
          color: '#6d7cff',
          isDefault: true,
          timeZone: FUSO,
        },
      },
    },
    include: { ownedCalendars: true },
  });

  const maria = await prisma.user.create({
    data: {
      id: mariaId,
      email: EMAIL_MARIA,
      handle: 'maria',
      displayName: 'Maria',
      passwordHash: SENHA_DEV,
      timeZone: FUSO,
      emailVerifiedAt: new Date(),
      settings: { create: { themePreset: 'dawn', accentColor: '#4adebb' } },
      ownedCalendars: {
        create: {
          id: randomUUID(),
          name: 'Órbita da Maria',
          kind: 'PERSONAL',
          color: '#4adebb',
          isDefault: true,
          timeZone: FUSO,
        },
      },
    },
    include: { ownedCalendars: true },
  });

  const agendaEnzo = enzo.ownedCalendars[0];

  // Cada dono é membro da própria agenda, com papel OWNER: as consultas de
  // leitura filtram por calendar_members, então sem esta linha o dono não veria
  // a própria agenda.
  await prisma.calendarMember.createMany({
    data: [
      { calendarId: agendaEnzo.id, userId: enzo.id, role: 'OWNER' },
      {
        calendarId: maria.ownedCalendars[0].id,
        userId: maria.id,
        role: 'OWNER',
      },
    ],
  });

  // A agenda compartilhada: o caso que o produto existe para resolver.
  const compartilhada = await prisma.calendar.create({
    data: {
      id: randomUUID(),
      ownerId: enzo.id,
      name: 'Nós dois',
      description: 'O que os dois precisam saber',
      kind: 'SHARED',
      color: '#a97bff',
      timeZone: FUSO,
      members: {
        create: [
          { userId: enzo.id, role: 'OWNER' },
          // Maria vê esta agenda em verde, sem alterar a cor que o Enzo vê.
          { userId: maria.id, role: 'EDITOR', colorOverride: '#4adebb' },
        ],
      },
    },
  });

  await prisma.event.createMany({
    data: [
      {
        id: randomUUID(),
        calendarId: compartilhada.id,
        createdById: enzo.id,
        title: 'Jantar de sexta',
        location: 'Em casa',
        startsAt: em(2, 20),
        endsAt: em(2, 22),
        timeZone: FUSO,
      },
      {
        // O caso que mais quebra implementações de calendário: a regra tem de
        // continuar às 9h locais mesmo após a virada do horário de verão.
        id: randomUUID(),
        calendarId: compartilhada.id,
        createdById: maria.id,
        title: 'Academia',
        startsAt: em(1, 9),
        endsAt: em(1, 10),
        timeZone: FUSO,
        recurrenceRule: 'FREQ=WEEKLY;BYDAY=TU,TH',
      },
      {
        id: randomUUID(),
        calendarId: compartilhada.id,
        createdById: enzo.id,
        title: 'Viagem',
        startsAt: em(10, 0),
        endsAt: em(12, 0),
        isAllDay: true,
        timeZone: FUSO,
      },
      {
        // Privado: não deve aparecer para a Maria, mesmo ela sendo EDITOR da
        // agenda. É o teste de privacidade que a Fase 3 tem de provar.
        id: randomUUID(),
        calendarId: compartilhada.id,
        createdById: enzo.id,
        title: 'Consulta médica',
        startsAt: em(4, 15),
        endsAt: em(4, 16),
        timeZone: FUSO,
        visibility: 'PRIVATE',
      },
    ],
  });

  await prisma.task.createMany({
    data: [
      {
        id: randomUUID(),
        calendarId: compartilhada.id,
        createdById: enzo.id,
        assigneeId: maria.id,
        title: 'Comprar os ingredientes',
        priority: 'MEDIUM',
        dueAt: em(2, 18),
        position: 1,
      },
      {
        id: randomUUID(),
        calendarId: agendaEnzo.id,
        createdById: enzo.id,
        title: 'Renovar a habilitação',
        priority: 'HIGH',
        dueAt: em(20, 12),
        isDueAllDay: true,
        position: 1,
      },
    ],
  });

  const [usuarios, agendas, eventos, tarefas, membros] = await Promise.all([
    prisma.user.count(),
    prisma.calendar.count(),
    prisma.event.count(),
    prisma.task.count(),
    prisma.calendarMember.count(),
  ]);

  console.log(
    `seed: ${usuarios} usuários, ${agendas} agendas, ${membros} vínculos, ` +
      `${eventos} eventos, ${tarefas} tarefas`,
  );
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

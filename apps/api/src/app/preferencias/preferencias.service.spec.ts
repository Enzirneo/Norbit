/**
 * Testes de integração das preferências, contra o Postgres de verdade.
 *
 * O que só aqui se prova: que as preferências nascem com a conta, que um PATCH
 * parcial não zera o resto, e que a preferência por agenda grava na linha do
 * **membro** — inclusive para o dono, que pode não ter uma.
 */
import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { TEMA_PADRAO, temaLegado } from '@norbit/contracts';
import { Prisma, PrismaModule, PrismaService } from '@norbit/db';
import { uuidv7 } from 'uuidv7';
import { AcessoService } from '../agendas/acesso.service';
import { AgendasService } from '../agendas/agendas.service';
import { PreferenciasService } from './preferencias.service';

const PREFIXO = 'teste-prefs';

/**
 * O acento padrão, escrito à mão de propósito.
 *
 * A API não depende de `@norbit/design-tokens` — a fronteira não permite, e com
 * razão: o servidor não tem nada a ver com cor. Aqui o valor literal é a
 * **asserção**: se o `@default` do banco mudar, este teste é quem avisa.
 */
const ACENTO_PADRAO = '#6d7cff';

describe('PreferenciasService', () => {
  let modulo: TestingModule;
  let preferencias: PreferenciasService;
  let agendas: AgendasService;
  let prisma: PrismaService;
  let enzo: string;

  beforeAll(async () => {
    modulo = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule],
      providers: [PreferenciasService, AgendasService, AcessoService],
    }).compile();

    await modulo.init();

    preferencias = modulo.get(PreferenciasService);
    agendas = modulo.get(AgendasService);
    prisma = modulo.get(PrismaService);
  });

  afterAll(async () => {
    await limpar(prisma);
    await modulo.close();
  });

  beforeEach(async () => {
    await limpar(prisma);
    enzo = await criarUsuario(prisma);
  });

  it('nascem com a conta, nos padrões do banco', async () => {
    const minhas = await preferencias.minhas(enzo);

    expect(minhas).toEqual({
      accentColor: ACENTO_PADRAO,
      tema: TEMA_PADRAO,
      density: 1,
      reducedMotion: false,
      defaultView: 'WEEK',
      weekStartsOn: 0,
      use24Hour: true,
    });
  });

  describe('tema', () => {
    const MEU_TEMA = {
      ...TEMA_PADRAO,
      base: null,
      sementes: { fundo: '#140a1f', destaque: '#ff6b8a', contraste: 'alto' },
      forma: { cantos: 12, estrelas: false, lua: true, hemisferio: 'norte' },
    } as const;

    it('guarda o tema inteiro e o devolve igual', async () => {
      await preferencias.atualizar(enzo, { tema: MEU_TEMA });

      expect((await preferencias.minhas(enzo)).tema).toEqual(MEU_TEMA);
    });

    it('mantém o par antigo em dia: o destaque do tema vira o accentColor', async () => {
      await preferencias.atualizar(enzo, { tema: MEU_TEMA });

      expect((await preferencias.minhas(enzo)).accentColor).toBe('#ff6b8a');
    });

    it('trocar só o accentColor atualiza o destaque do tema guardado', async () => {
      await preferencias.atualizar(enzo, { tema: MEU_TEMA });

      await preferencias.atualizar(enzo, { accentColor: '#4adebb' });
      const { tema } = await preferencias.minhas(enzo);

      expect(tema.sementes.destaque).toBe('#4adebb');
      expect(tema.sementes.fundo).toBe('#140a1f');
      expect(tema.forma.cantos).toBe(12);
    });

    it('uma conta sem tema guardado recebe o derivado do par antigo', async () => {
      await prisma.userSettings.update({
        where: { userId: enzo },
        data: {
          themePreset: 'dawn',
          accentColor: '#4adebb',
          appearance: Prisma.DbNull,
        },
      });

      expect((await preferencias.minhas(enzo)).tema).toEqual(
        temaLegado('dawn', '#4adebb'),
      );
    });

    it('um tema guardado que ficou inválido não derruba a leitura', async () => {
      await prisma.userSettings.update({
        where: { userId: enzo },
        data: { appearance: { v: 99, lixo: true } },
      });

      expect((await preferencias.minhas(enzo)).tema).toEqual(TEMA_PADRAO);
    });

    it('trocar a densidade não mexe no tema', async () => {
      await preferencias.atualizar(enzo, { tema: MEU_TEMA });

      await preferencias.atualizar(enzo, { density: 2 });

      expect((await preferencias.minhas(enzo)).tema).toEqual(MEU_TEMA);
    });
  });

  it('a cor de destaque padrão é minúscula', async () => {
    // O `@default` do banco e a paleta precisam casar: foi assim que a
    // validação do contrato passou a recusar uma cor que ela mesma oferecia.
    const { accentColor } = await preferencias.minhas(enzo);

    expect(accentColor).toBe(accentColor.toLowerCase());
  });

  it('um PATCH parcial não zera o resto', async () => {
    await preferencias.atualizar(enzo, { density: 0 });
    const minhas = await preferencias.minhas(enzo);

    expect(minhas.density).toBe(0);
    expect(minhas.accentColor).toBe(ACENTO_PADRAO);
    expect(minhas.defaultView).toBe('WEEK');
  });

  it('guarda a visão padrão e o início da semana', async () => {
    await preferencias.atualizar(enzo, {
      defaultView: 'DAY',
      weekStartsOn: 1,
    });

    const minhas = await preferencias.minhas(enzo);
    expect(minhas.defaultView).toBe('DAY');
    expect(minhas.weekStartsOn).toBe(1);
  });

  describe('as preferências por agenda', () => {
    it('o dono consegue esconder a própria agenda', async () => {
      // `upsert` e não `update`: o dono tem acesso por `ownerId` e pode não ter
      // linha de membro. Com `update`, a preferência iria para nenhuma linha e
      // sumiria sem erro.
      const agenda = await agendas.criar(enzo, {
        name: 'Casa',
        kind: 'PERSONAL',
        color: ACENTO_PADRAO,
      });
      await prisma.calendarMember.deleteMany({
        where: { calendarId: agenda.id, userId: enzo },
      });

      await agendas.definirPreferencias({
        userId: enzo,
        calendarId: agenda.id,
        dados: { isHidden: true },
      });

      const [lida] = await agendas.listar(enzo);
      expect(lida?.escondida).toBe(true);
    });

    it('a agenda volta a aparecer quando é desescondida', async () => {
      const agenda = await agendas.criar(enzo, {
        name: 'Casa',
        kind: 'PERSONAL',
        color: ACENTO_PADRAO,
      });

      await agendas.definirPreferencias({
        userId: enzo,
        calendarId: agenda.id,
        dados: { isHidden: true },
      });
      await agendas.definirPreferencias({
        userId: enzo,
        calendarId: agenda.id,
        dados: { isHidden: false },
      });

      expect((await agendas.listar(enzo))[0]?.escondida).toBe(false);
    });

    it('guarda a cor própria sem alterar a cor da agenda', async () => {
      // É o que torna a sobreposição de agendas legível: cada membro escolhe a
      // cor com que **ele** vê, sem mexer na que os outros veem.
      const agenda = await agendas.criar(enzo, {
        name: 'Casa',
        kind: 'SHARED',
        color: ACENTO_PADRAO,
      });

      await agendas.definirPreferencias({
        userId: enzo,
        calendarId: agenda.id,
        dados: { colorOverride: '#123456' },
      });

      const [lida] = await agendas.listar(enzo);
      expect(lida?.corPropria).toBe('#123456');
      expect(lida?.color).toBe(ACENTO_PADRAO);
    });

    it('a agenda recém-criada não está escondida', async () => {
      const agenda = await agendas.criar(enzo, {
        name: 'Casa',
        kind: 'PERSONAL',
        color: ACENTO_PADRAO,
      });

      expect(agenda.escondida).toBe(false);
      expect(agenda.corPropria).toBeNull();
    });
  });
});

async function criarUsuario(prisma: PrismaService): Promise<string> {
  const id = uuidv7();

  await prisma.user.create({
    data: {
      id,
      email: `${PREFIXO}@norbit.dev`,
      handle: PREFIXO.replace('-', '_'),
      displayName: 'Teste',
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

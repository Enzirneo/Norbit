import {
  atualizarEventoSchema,
  consultaDeEventosSchema,
  criarEventoSchema,
  LIMITE_DE_DIAS_CONSULTADOS,
} from './evento';

const BASE = {
  title: 'Jantar',
  startsAt: '2026-11-01T22:00:00Z',
  endsAt: '2026-11-02T00:00:00Z',
  timeZone: 'America/Sao_Paulo',
};

describe('criarEventoSchema', () => {
  it('converte as datas e aplica os padrões', () => {
    const evento = criarEventoSchema.parse(BASE);

    expect(evento.startsAt.toISOString()).toBe('2026-11-01T22:00:00.000Z');
    expect(evento.isAllDay).toBe(false);
    expect(evento.status).toBe('CONFIRMED');
    expect(evento.visibility).toBe('INHERITED');
  });

  it('recusa fim antes do início, apontando o campo', () => {
    const resultado = criarEventoSchema.safeParse({
      ...BASE,
      endsAt: '2026-11-01T21:00:00Z',
    });

    expect(resultado.success).toBe(false);
    // O caminho importa: é o que faz a mensagem aparecer embaixo do campo
    // certo no formulário, em vez de como um erro solto no topo.
    expect(resultado.error?.issues[0]?.path).toEqual(['endsAt']);
  });

  it('aceita evento de duração zero', () => {
    // Um marco no tempo ("entrega do relatório") é um evento legítimo.
    const evento = criarEventoSchema.parse({
      ...BASE,
      endsAt: BASE.startsAt,
    });

    expect(evento.endsAt.getTime()).toBe(evento.startsAt.getTime());
  });

  it('aceita a regra de recorrência como texto, sem interpretá-la', () => {
    // Ler RRULE é de `libs/domain`, e os contratos não podem depender dela. O
    // serviço é quem recusa o que não implementa.
    const evento = criarEventoSchema.parse({
      ...BASE,
      recurrenceRule: 'FREQ=WEEKLY;BYSETPOS=2',
    });

    expect(evento.recurrenceRule).toBe('FREQ=WEEKLY;BYSETPOS=2');
  });
});

describe('atualizarEventoSchema', () => {
  it('recusa um PATCH vazio', () => {
    expect(atualizarEventoSchema.safeParse({}).success).toBe(false);
  });

  it('recusa fim antes do início quando os dois vêm juntos', () => {
    const resultado = atualizarEventoSchema.safeParse({
      startsAt: '2026-11-01T22:00:00Z',
      endsAt: '2026-11-01T21:00:00Z',
    });

    expect(resultado.success).toBe(false);
  });

  it('deixa passar um fim sozinho — e isso é esperado', () => {
    // A verificação é incompleta por natureza: sem a linha gravada não há com o
    // que comparar. Este teste documenta o limite e o contrato com o serviço,
    // que compara contra o banco. Sem ele, alguém "corrigiria" o schema
    // acrescentando uma regra que não tem como funcionar.
    expect(
      atualizarEventoSchema.safeParse({ endsAt: '2020-01-01T00:00:00Z' })
        .success,
    ).toBe(true);
  });
});

describe('consultaDeEventosSchema', () => {
  const INTERVALO = { de: '2026-11-01T00:00:00Z', ate: '2026-12-01T00:00:00Z' };

  it('lê a lista de agendas separada por vírgula', () => {
    const consulta = consultaDeEventosSchema.parse({
      ...INTERVALO,
      agendas:
        '0193f0a0-0000-7000-8000-000000000001, 0193f0a0-0000-7000-8000-000000000002',
    });

    expect(consulta.agendas).toHaveLength(2);
  });

  it('ausência de agendas significa todas as que eu vejo', () => {
    expect(consultaDeEventosSchema.parse(INTERVALO).agendas).toBeUndefined();
  });

  it('recusa intervalo invertido', () => {
    expect(
      consultaDeEventosSchema.safeParse({
        de: INTERVALO.ate,
        ate: INTERVALO.de,
      }).success,
    ).toBe(false);
  });

  it(`recusa intervalo acima de ${LIMITE_DE_DIAS_CONSULTADOS} dias`, () => {
    // Recusar na entrada em vez de deixar a expansão de recorrência estourar o
    // limite dela: a mensagem aqui diz o que fazer.
    const de = new Date('2026-01-01T00:00:00Z');
    const ate = new Date(
      de.getTime() + (LIMITE_DE_DIAS_CONSULTADOS + 1) * 86_400_000,
    );

    expect(
      consultaDeEventosSchema.safeParse({
        de: de.toISOString(),
        ate: ate.toISOString(),
      }).success,
    ).toBe(false);
  });

  it('aceita exatamente o limite', () => {
    const de = new Date('2026-01-01T00:00:00Z');
    const ate = new Date(
      de.getTime() + LIMITE_DE_DIAS_CONSULTADOS * 86_400_000,
    );

    expect(
      consultaDeEventosSchema.safeParse({
        de: de.toISOString(),
        ate: ate.toISOString(),
      }).success,
    ).toBe(true);
  });
});

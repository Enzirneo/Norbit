/**
 * Evento de dia inteiro.
 *
 * O campo `isAllDay` sozinho não resolve nada: o que define o comportamento é
 * **o que está gravado** em `startsAt` e `endsAt`. Sem uma normalização única, o
 * mesmo "dia 15" chega como meia-noite local de um cliente, como 23:59:59 de
 * outro e como meia-noite UTC de um terceiro — e aí o evento aparece no dia
 * errado para quem não está no fuso do servidor.
 */
import { paraHoraLocal } from '../tempo/zona';
import { fimExclusivoDoDia, normalizarDiaInteiro } from './dia-inteiro';

const SAO_PAULO = 'America/Sao_Paulo';
const NOVA_YORK = 'America/New_York';

/** Lê o resultado como hora de parede, que é como a interface vai mostrar. */
function local(instante: Date, fuso: string): string {
  const h = paraHoraLocal(instante, fuso);
  return `${h.ano}-${String(h.mes).padStart(2, '0')}-${String(h.dia).padStart(2, '0')} ${String(h.hora).padStart(2, '0')}:${String(h.minuto).padStart(2, '0')}`;
}

describe('normalizarDiaInteiro', () => {
  it('encaixa um dia único entre duas meia-noites locais', () => {
    // O fim é **exclusivo**, como a RFC 5545 define para `DTEND` em forma de
    // data. É o que faz a conta de sobreposição funcionar sem um a-menos: um
    // dia inteiro tem a duração de um dia, não de 23:59:59.
    const { inicio, fim } = normalizarDiaInteiro({
      inicio: new Date('2026-06-15T13:45:00Z'),
      fim: new Date('2026-06-15T18:20:00Z'),
      fuso: SAO_PAULO,
    });

    expect(local(inicio, SAO_PAULO)).toBe('2026-06-15 00:00');
    expect(local(fim, SAO_PAULO)).toBe('2026-06-16 00:00');
  });

  it('cobre o intervalo inteiro de vários dias', () => {
    const { inicio, fim } = normalizarDiaInteiro({
      inicio: new Date('2026-06-15T13:45:00Z'),
      fim: new Date('2026-06-18T09:00:00Z'),
      fuso: SAO_PAULO,
    });

    expect(local(inicio, SAO_PAULO)).toBe('2026-06-15 00:00');
    expect(local(fim, SAO_PAULO)).toBe('2026-06-19 00:00');
  });

  it('é idempotente', () => {
    // A propriedade que resolve a ambiguidade do que chega: um cliente manda o
    // fim como instante dentro do último dia, outro já manda a meia-noite
    // exclusiva. Normalizar duas vezes tem de dar o mesmo resultado, ou um
    // PATCH que não mexe nas datas empurraria o evento um dia para frente a
    // cada salvamento.
    const entrada = {
      inicio: new Date('2026-06-15T13:45:00Z'),
      fim: new Date('2026-06-18T09:00:00Z'),
      fuso: SAO_PAULO,
    };

    const uma = normalizarDiaInteiro(entrada);
    const duas = normalizarDiaInteiro({ ...uma, fuso: SAO_PAULO });

    expect(duas.inicio.toISOString()).toBe(uma.inicio.toISOString());
    expect(duas.fim.toISOString()).toBe(uma.fim.toISOString());
  });

  it('nunca produz um dia inteiro de duração zero', () => {
    // O caso que a idempotência cria sozinha: se o fim chega já na meia-noite
    // do próprio dia de início, tratá-lo como limite exclusivo daria um evento
    // de nenhum dia.
    const { inicio, fim } = normalizarDiaInteiro({
      inicio: new Date('2026-06-15T03:00:00Z'), // meia-noite em São Paulo
      fim: new Date('2026-06-15T03:00:00Z'),
      fuso: SAO_PAULO,
    });

    expect(local(inicio, SAO_PAULO)).toBe('2026-06-15 00:00');
    expect(local(fim, SAO_PAULO)).toBe('2026-06-16 00:00');
  });

  it('respeita o fuso do evento, não o do servidor', () => {
    // O mesmo instante cai em dias diferentes em fusos diferentes. 02:00 UTC do
    // dia 15 ainda é o dia 14 em Nova York.
    const entrada = {
      inicio: new Date('2026-06-15T02:00:00Z'),
      fim: new Date('2026-06-15T02:00:00Z'),
    };

    expect(
      local(
        normalizarDiaInteiro({ ...entrada, fuso: NOVA_YORK }).inicio,
        NOVA_YORK,
      ),
    ).toBe('2026-06-14 00:00');
    expect(
      local(
        normalizarDiaInteiro({ ...entrada, fuso: SAO_PAULO }).inicio,
        SAO_PAULO,
      ),
    ).toBe('2026-06-14 00:00');
  });

  describe('nas viradas de horário de verão', () => {
    it('o dia que perde uma hora dura 23 horas', () => {
      // 8 de março de 2026 em Nova York salta de 02:00 para 03:00. Um dia
      // inteiro naquele dia é mais curto, e isso é o correto: "o dia 8" vai da
      // meia-noite do 8 à meia-noite do 9, não 24 horas cravadas.
      const { inicio, fim } = normalizarDiaInteiro({
        inicio: new Date('2026-03-08T12:00:00Z'),
        fim: new Date('2026-03-08T12:00:00Z'),
        fuso: NOVA_YORK,
      });

      const horas = (fim.getTime() - inicio.getTime()) / 3_600_000;
      expect(horas).toBe(23);
      expect(local(inicio, NOVA_YORK)).toBe('2026-03-08 00:00');
      expect(local(fim, NOVA_YORK)).toBe('2026-03-09 00:00');
    });

    it('o dia que ganha uma hora dura 25 horas', () => {
      const { inicio, fim } = normalizarDiaInteiro({
        inicio: new Date('2026-11-01T12:00:00Z'),
        fim: new Date('2026-11-01T12:00:00Z'),
        fuso: NOVA_YORK,
      });

      expect((fim.getTime() - inicio.getTime()) / 3_600_000).toBe(25);
    });
  });
});

describe('fimExclusivoDoDia', () => {
  it('fecha o dia na meia-noite seguinte, no fuso pedido', () => {
    const fim = fimExclusivoDoDia(new Date('2026-06-15T13:45:00Z'), SAO_PAULO);

    expect(local(fim, SAO_PAULO)).toBe('2026-06-16 00:00');
  });

  it('é idempotente', () => {
    // Sem isto, um PATCH que não mexe no prazo empurraria a tarefa um dia para
    // frente a cada salvamento — e ninguém notaria até reclamarem que a tarefa
    // "nunca fica atrasada".
    const uma = fimExclusivoDoDia(new Date('2026-06-15T13:45:00Z'), SAO_PAULO);
    const duas = fimExclusivoDoDia(uma, SAO_PAULO);

    expect(duas.toISOString()).toBe(uma.toISOString());
  });

  it('respeita o fuso, não o do servidor', () => {
    // 02:00Z do dia 15 ainda é o dia 14 em Nova York, então o dia fecha um dia
    // antes do que fecharia em São Paulo.
    const quando = new Date('2026-06-15T02:00:00Z');

    expect(local(fimExclusivoDoDia(quando, NOVA_YORK), NOVA_YORK)).toBe(
      '2026-06-15 00:00',
    );
    expect(local(fimExclusivoDoDia(quando, SAO_PAULO), SAO_PAULO)).toBe(
      '2026-06-15 00:00',
    );
  });

  it('não tem piso de um dia, ao contrário do evento', () => {
    // Um prazo não tem duração: a meia-noite do dia 15 fecha o dia 14, e isso
    // é o correto. Um evento no mesmo caso ganharia um dia inteiro.
    const meiaNoiteDoDia15 = new Date('2026-06-15T03:00:00Z');

    expect(
      local(fimExclusivoDoDia(meiaNoiteDoDia15, SAO_PAULO), SAO_PAULO),
    ).toBe('2026-06-15 00:00');
    expect(
      local(
        normalizarDiaInteiro({
          inicio: meiaNoiteDoDia15,
          fim: meiaNoiteDoDia15,
          fuso: SAO_PAULO,
        }).fim,
        SAO_PAULO,
      ),
    ).toBe('2026-06-16 00:00');
  });
});

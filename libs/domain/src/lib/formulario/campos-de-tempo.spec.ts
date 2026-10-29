/**
 * Os campos de data e hora de um formulário.
 *
 * `<input type="date">` e `<input type="time">` devolvem **texto de parede** —
 * "2026-06-15" e "09:00" — sem fuso nenhum. Virar instante exige saber em que
 * fuso aquelas 9h acontecem, e é aqui que nasce o defeito "marquei 9h e salvou
 * 6h": usar o fuso do navegador quando o evento é de outro.
 */
import {
  deCamposParaInstante,
  deInstanteParaCampos,
  type CamposDeTempo,
} from './campos-de-tempo';

const SAO_PAULO = 'America/Sao_Paulo';
const NOVA_YORK = 'America/New_York';

describe('deCamposParaInstante', () => {
  it('interpreta a hora no fuso pedido', () => {
    // 9h em São Paulo (UTC-3) é 12h UTC.
    expect(
      deCamposParaInstante(
        { data: '2026-06-15', hora: '09:00' },
        SAO_PAULO,
      ).toISOString(),
    ).toBe('2026-06-15T12:00:00.000Z');
  });

  it('o mesmo texto em outro fuso dá outro instante', () => {
    // A razão de a função existir. Em junho Nova York é UTC-4.
    expect(
      deCamposParaInstante(
        { data: '2026-06-15', hora: '09:00' },
        NOVA_YORK,
      ).toISOString(),
    ).toBe('2026-06-15T13:00:00.000Z');
  });

  it('sem hora, usa a meia-noite local', () => {
    // É a forma que o dia inteiro manda: o servidor normaliza para o fim
    // exclusivo do dia (ver docs/09).
    expect(
      deCamposParaInstante({ data: '2026-06-15' }, SAO_PAULO).toISOString(),
    ).toBe('2026-06-15T03:00:00.000Z');
  });

  it('segue a política da hora que não existe', () => {
    // 8 de março de 2026 em Nova York salta de 02:00 para 03:00. Quem digitar
    // 02:30 recebe 03:30 — a mesma política de `paraInstante`, e não um erro
    // que o formulário não saberia explicar.
    expect(
      deCamposParaInstante(
        { data: '2026-03-08', hora: '02:30' },
        NOVA_YORK,
      ).toISOString(),
    ).toBe('2026-03-08T07:30:00.000Z');
  });

  describe('entradas que o navegador não produz, mas um POST produz', () => {
    it('recusa data em formato livre', () => {
      expect(() =>
        deCamposParaInstante({ data: '15/06/2026' }, SAO_PAULO),
      ).toThrow(/data/i);
    });

    it('recusa data que não existe no calendário', () => {
      // 31 de fevereiro passa pela expressão regular e não é um dia.
      expect(() =>
        deCamposParaInstante({ data: '2026-02-31' }, SAO_PAULO),
      ).toThrow(/data/i);
    });

    it('recusa hora fora do relógio', () => {
      expect(() =>
        deCamposParaInstante({ data: '2026-06-15', hora: '25:00' }, SAO_PAULO),
      ).toThrow(/hora/i);
      expect(() =>
        deCamposParaInstante({ data: '2026-06-15', hora: '09:60' }, SAO_PAULO),
      ).toThrow(/hora/i);
    });
  });
});

describe('deInstanteParaCampos', () => {
  it('lê a hora de parede do fuso pedido', () => {
    expect(
      deInstanteParaCampos(new Date('2026-06-15T12:00:00Z'), SAO_PAULO),
    ).toEqual({ data: '2026-06-15', hora: '09:00' });
  });

  it('zera à esquerda, porque o input exige', () => {
    // `<input type="time">` recusa "9:5" em silêncio e fica vazio — o campo
    // apareceria em branco num evento que tem horário.
    expect(
      deInstanteParaCampos(new Date('2026-06-15T12:05:00Z'), SAO_PAULO),
    ).toEqual({ data: '2026-06-15', hora: '09:05' });
    expect(
      deInstanteParaCampos(new Date('2026-01-05T12:05:00Z'), SAO_PAULO),
    ).toEqual({ data: '2026-01-05', hora: '09:05' });
  });

  it('atravessa a meia-noite para o dia certo', () => {
    // 02:00Z é ainda o dia 14 em Nova York. Errar aqui abre o formulário no
    // dia errado.
    expect(
      deInstanteParaCampos(new Date('2026-06-15T02:00:00Z'), NOVA_YORK),
    ).toEqual({ data: '2026-06-14', hora: '22:00' });
  });

  describe('a ida e volta', () => {
    it.each([
      ['2026-06-15', '09:00', SAO_PAULO],
      ['2026-01-31', '23:59', SAO_PAULO],
      ['2026-12-25', '00:00', NOVA_YORK],
      ['2026-07-04', '14:30', NOVA_YORK],
    ])('%s %s em %s volta igual', (data, hora, fuso) => {
      const campos: CamposDeTempo = { data, hora };

      expect(
        deInstanteParaCampos(deCamposParaInstante(campos, fuso), fuso),
      ).toEqual(campos);
    });
  });
});

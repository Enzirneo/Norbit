import { avancarPeriodo } from './navegacao';

describe('avancarPeriodo', () => {
  describe('por dia', () => {
    it('anda um dia', () => {
      expect(avancarPeriodo({ ano: 2026, mes: 6, dia: 15 }, 'DAY', 1)).toEqual({
        ano: 2026,
        mes: 6,
        dia: 16,
      });
    });

    it('atravessa a virada do mês', () => {
      expect(avancarPeriodo({ ano: 2026, mes: 6, dia: 30 }, 'DAY', 1)).toEqual({
        ano: 2026,
        mes: 7,
        dia: 1,
      });
    });

    it('atravessa a virada do ano para trás', () => {
      expect(avancarPeriodo({ ano: 2027, mes: 1, dia: 1 }, 'DAY', -1)).toEqual({
        ano: 2026,
        mes: 12,
        dia: 31,
      });
    });

    it('acerta 29 de fevereiro em ano bissexto', () => {
      expect(avancarPeriodo({ ano: 2028, mes: 2, dia: 28 }, 'DAY', 1)).toEqual({
        ano: 2028,
        mes: 2,
        dia: 29,
      });
    });
  });

  describe('por semana', () => {
    it('anda sete dias', () => {
      expect(avancarPeriodo({ ano: 2026, mes: 6, dia: 15 }, 'WEEK', 1)).toEqual(
        {
          ano: 2026,
          mes: 6,
          dia: 22,
        },
      );
    });

    it('preserva o dia da semana atravessando o mês', () => {
      // 15 de junho de 2026 é uma segunda; três semanas depois é 6 de julho, e
      // também uma segunda.
      const depois = avancarPeriodo({ ano: 2026, mes: 6, dia: 15 }, 'WEEK', 3);

      expect(depois).toEqual({ ano: 2026, mes: 7, dia: 6 });
      expect(new Date(Date.UTC(2026, 6, 6)).getUTCDay()).toBe(
        new Date(Date.UTC(2026, 5, 15)).getUTCDay(),
      );
    });
  });

  describe('por mês', () => {
    it('anda um mês', () => {
      expect(avancarPeriodo({ ano: 2026, mes: 6, dia: 1 }, 'MONTH', 1)).toEqual(
        {
          ano: 2026,
          mes: 7,
          dia: 1,
        },
      );
    });

    it('atravessa a virada do ano nos dois sentidos', () => {
      expect(
        avancarPeriodo({ ano: 2026, mes: 12, dia: 1 }, 'MONTH', 1),
      ).toEqual({
        ano: 2027,
        mes: 1,
        dia: 1,
      });
      expect(
        avancarPeriodo({ ano: 2026, mes: 1, dia: 1 }, 'MONTH', -1),
      ).toEqual({
        ano: 2025,
        mes: 12,
        dia: 1,
      });
    });

    it('volta o dia para 1º, em vez de inventar um 31 de fevereiro', () => {
      // O caso que se erra calado: somar um mês a 31 de janeiro não tem resposta
      // boa. 28 de fevereiro perde informação; 3 de março muda de mês. Na visão
      // de mês o dia não é usado, então 1º é a resposta que não inventa nada.
      expect(
        avancarPeriodo({ ano: 2026, mes: 1, dia: 31 }, 'MONTH', 1),
      ).toEqual({
        ano: 2026,
        mes: 2,
        dia: 1,
      });
    });

    it('vários meses de uma vez', () => {
      expect(
        avancarPeriodo({ ano: 2026, mes: 11, dia: 1 }, 'MONTH', 4),
      ).toEqual({
        ano: 2027,
        mes: 3,
        dia: 1,
      });
    });
  });

  it('passo zero não move', () => {
    const data = { ano: 2026, mes: 6, dia: 15 };

    for (const periodo of ['DAY', 'WEEK', 'MONTH'] as const) {
      const depois = avancarPeriodo(data, periodo, 0);
      expect(depois.ano).toBe(2026);
      expect(depois.mes).toBe(6);
    }
  });

  it('recusa passo fracionário', () => {
    expect(() =>
      avancarPeriodo({ ano: 2026, mes: 6, dia: 15 }, 'DAY', 1.5),
    ).toThrow(/passo/i);
  });
});

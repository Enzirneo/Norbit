import { lerRrule } from './rrule';

describe('lerRrule', () => {
  it('lê a regra mínima', () => {
    expect(lerRrule('FREQ=DAILY')).toEqual({
      freq: 'DAILY',
      intervalo: 1,
    });
  });

  it('aceita o prefixo RRULE: que alguns clientes mandam', () => {
    expect(lerRrule('RRULE:FREQ=WEEKLY').freq).toBe('WEEKLY');
  });

  it('ignora caixa e espaço em volta', () => {
    expect(lerRrule('  freq=weekly;interval=2 ')).toEqual({
      freq: 'WEEKLY',
      intervalo: 2,
    });
  });

  it('lê os dias da semana', () => {
    expect(lerRrule('FREQ=WEEKLY;BYDAY=TU,TH').porDiaDaSemana).toEqual([
      'TU',
      'TH',
    ]);
  });

  it('lê o dia do mês, inclusive contado do fim', () => {
    expect(lerRrule('FREQ=MONTHLY;BYMONTHDAY=1,-1').porDiaDoMes).toEqual([
      1, -1,
    ]);
  });

  it('lê a ordem dentro do mês: segunda terça, última sexta', () => {
    expect(lerRrule('FREQ=MONTHLY;BYDAY=2TU').porDiaDaSemanaNoMes).toEqual([
      { ordem: 2, dia: 'TU' },
    ]);
    expect(lerRrule('FREQ=MONTHLY;BYDAY=-1FR').porDiaDaSemanaNoMes).toEqual([
      { ordem: -1, dia: 'FR' },
    ]);
  });

  it('lê o limite por contagem', () => {
    expect(lerRrule('FREQ=DAILY;COUNT=10').ocorrencias).toBe(10);
  });

  it('lê o limite por data, em UTC', () => {
    const regra = lerRrule('FREQ=DAILY;UNTIL=20261231T235959Z');

    expect(regra.ate?.toISOString()).toBe('2026-12-31T23:59:59.000Z');
  });

  it('aceita UNTIL em forma de data pura', () => {
    expect(lerRrule('FREQ=DAILY;UNTIL=20261231').ate?.toISOString()).toBe(
      '2026-12-31T23:59:59.999Z',
    );
  });

  describe('o que ela recusa, e por quê', () => {
    it('recusa regra sem FREQ', () => {
      expect(() => lerRrule('INTERVAL=2')).toThrow(/FREQ/);
    });

    it('recusa FREQ que não existe', () => {
      expect(() => lerRrule('FREQ=HOURLY')).toThrow(/HOURLY/);
    });

    it('recusa COUNT e UNTIL juntos', () => {
      // A RFC 5545 proíbe os dois na mesma regra, e com razão: não há resposta
      // óbvia para qual vence.
      expect(() => lerRrule('FREQ=DAILY;COUNT=5;UNTIL=20261231')).toThrow(
        /COUNT|UNTIL/,
      );
    });

    it('recusa INTERVAL zero ou negativo', () => {
      expect(() => lerRrule('FREQ=DAILY;INTERVAL=0')).toThrow(/INTERVAL/);
    });

    it('recusa dia da semana inválido', () => {
      expect(() => lerRrule('FREQ=WEEKLY;BYDAY=XX')).toThrow(/XX/);
    });

    it('recusa parte que ela não implementa, em vez de ignorar', () => {
      // Ignorar em silêncio é o pior caminho: a regra geraria ocorrências
      // diferentes das que a pessoa pediu, e ninguém saberia por quê.
      expect(() => lerRrule('FREQ=MONTHLY;BYSETPOS=1;BYDAY=MO')).toThrow(
        /BYSETPOS/,
      );
      expect(() => lerRrule('FREQ=YEARLY;BYWEEKNO=5')).toThrow(/BYWEEKNO/);
    });

    it('recusa parâmetro desconhecido', () => {
      expect(() => lerRrule('FREQ=DAILY;FREQUENCIA=2')).toThrow(/FREQUENCIA/);
    });
  });
});

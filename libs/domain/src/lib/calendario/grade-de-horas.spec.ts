/**
 * A grade de horas das visões de semana e dia.
 *
 * O que ela resolve é posicionar um evento verticalmente: de onde começa a
 * faixa e que altura ela tem, como fração do dia.
 *
 * E a armadilha é que **um dia não tem sempre 24 horas**. Nos dois dias de
 * virada de horário de verão ele tem 23 ou 25, e dividir "minutos desde a
 * meia-noite" por 1440 desloca tudo depois da virada — num dia de 23h, as 23:00
 * cairiam fora da grade.
 */
import {
  diasDaSemanaDe,
  faixaNoDia,
  horasDoDia,
  intervaloDosDias,
  type Posicao,
} from './grade-de-horas';

const SAO_PAULO = 'America/Sao_Paulo';
const NOVA_YORK = 'America/New_York';

/** Arredonda para quatro casas, para comparar fração sem ruído de ponto flutuante. */
function arredondar(p: Posicao): { topo: number; altura: number } {
  return {
    topo: Math.round(p.topo * 10_000) / 10_000,
    altura: Math.round(p.altura * 10_000) / 10_000,
  };
}

describe('horasDoDia', () => {
  it('um dia comum tem 24 marcas de hora', () => {
    const horas = horasDoDia({ ano: 2026, mes: 6, dia: 15 }, SAO_PAULO);

    expect(horas).toHaveLength(24);
    expect(horas[0]).toEqual({ hora: 0, posicao: 0 });
    expect(horas[12]?.hora).toBe(12);
  });

  it('as marcas ficam igualmente espaçadas num dia comum', () => {
    const horas = horasDoDia({ ano: 2026, mes: 6, dia: 15 }, SAO_PAULO);

    expect(Math.round((horas[6]?.posicao ?? 0) * 10_000) / 10_000).toBe(0.25);
    expect(Math.round((horas[18]?.posicao ?? 0) * 10_000) / 10_000).toBe(0.75);
  });

  describe('nos dias de virada', () => {
    it('o dia que perde uma hora tem 23 marcas, e a hora que não existe sai', () => {
      // 8 de março de 2026 em Nova York salta de 02:00 para 03:00. As 02:00 não
      // existem, e uma marca ali seria uma linha apontando para nada.
      const horas = horasDoDia({ ano: 2026, mes: 3, dia: 8 }, NOVA_YORK);

      expect(horas).toHaveLength(23);
      expect(horas.map((h) => h.hora)).not.toContain(2);
    });

    it('o dia que ganha uma hora tem 24 marcas, com a hora repetida uma vez só', () => {
      // 1º de novembro de 2026 volta de 02:00 para 01:00. A hora 01 acontece
      // duas vezes; a grade mostra uma marca, na primeira passagem — repetir
      // "1h" em duas linhas diferentes seria incompreensível.
      const horas = horasDoDia({ ano: 2026, mes: 11, dia: 1 }, NOVA_YORK);

      expect(horas).toHaveLength(24);
      expect(horas.filter((h) => h.hora === 1)).toHaveLength(1);
    });

    it('as marcas depois da virada não ficam igualmente espaçadas', () => {
      // É a consequência correta de o dia ter 25 horas: a parte da manhã ocupa
      // proporcionalmente menos. Espaçar igual seria desenhar um dia de 24h e
      // colocar os eventos no lugar errado.
      const horas = horasDoDia({ ano: 2026, mes: 11, dia: 1 }, NOVA_YORK);
      const meioDia = horas.find((h) => h.hora === 12);

      // Meio-dia num dia de 25h está a 13/25 do começo, não a 12/24.
      expect(Math.round((meioDia?.posicao ?? 0) * 100) / 100).toBe(0.52);
    });
  });

  it('recusa fuso que não existe', () => {
    expect(() =>
      horasDoDia({ ano: 2026, mes: 6, dia: 15 }, 'Marte/Olympus'),
    ).toThrow(/fuso/i);
  });
});

describe('faixaNoDia', () => {
  const DIA = { ano: 2026, mes: 6, dia: 15 };

  it('posiciona um evento pela fração do dia', () => {
    // 09:00 às 10:00 locais num dia de 24h: começa a 9/24, ocupa 1/24.
    expect(
      arredondar(
        faixaNoDia({
          dia: DIA,
          fuso: SAO_PAULO,
          inicio: new Date('2026-06-15T12:00:00Z'),
          fim: new Date('2026-06-15T13:00:00Z'),
        }) as Posicao,
      ),
    ).toEqual({ topo: 0.375, altura: 0.0417 });
  });

  it('recorta quem começou no dia anterior', () => {
    // Entra às 00:00 do dia e termina às 02:00 locais.
    expect(
      arredondar(
        faixaNoDia({
          dia: DIA,
          fuso: SAO_PAULO,
          inicio: new Date('2026-06-14T20:00:00Z'),
          fim: new Date('2026-06-15T05:00:00Z'),
        }) as Posicao,
      ),
    ).toEqual({ topo: 0, altura: 0.0833 });
  });

  it('recorta quem segue para o dia seguinte', () => {
    expect(
      arredondar(
        faixaNoDia({
          dia: DIA,
          fuso: SAO_PAULO,
          inicio: new Date('2026-06-16T01:00:00Z'), // 22:00 locais do dia 15
          fim: new Date('2026-06-16T15:00:00Z'),
        }) as Posicao,
      ),
    ).toEqual({ topo: 0.9167, altura: 0.0833 });
  });

  it('um evento que cobre o dia inteiro vai de 0 a 1', () => {
    expect(
      arredondar(
        faixaNoDia({
          dia: DIA,
          fuso: SAO_PAULO,
          inicio: new Date('2026-06-10T00:00:00Z'),
          fim: new Date('2026-06-20T00:00:00Z'),
        }) as Posicao,
      ),
    ).toEqual({ topo: 0, altura: 1 });
  });

  describe('quem não toca o dia fica de fora', () => {
    it('termina antes do dia começar', () => {
      expect(
        faixaNoDia({
          dia: DIA,
          fuso: SAO_PAULO,
          inicio: new Date('2026-06-14T10:00:00Z'),
          fim: new Date('2026-06-15T03:00:00Z'), // a meia-noite que abre o dia
        }),
      ).toBeNull();
    });

    it('começa depois do dia terminar', () => {
      expect(
        faixaNoDia({
          dia: DIA,
          fuso: SAO_PAULO,
          inicio: new Date('2026-06-16T03:00:00Z'), // a meia-noite que o fecha
          fim: new Date('2026-06-16T10:00:00Z'),
        }),
      ).toBeNull();
    });
  });

  it('o marco de duração zero tem altura mínima, não zero', () => {
    // Uma faixa de altura 0 é invisível. O mínimo é o que faz um evento sem
    // duração aparecer — e é a mesma razão de ele existir na visão de mês.
    const p = faixaNoDia({
      dia: DIA,
      fuso: SAO_PAULO,
      inicio: new Date('2026-06-15T12:00:00Z'),
      fim: new Date('2026-06-15T12:00:00Z'),
    }) as Posicao;

    expect(p.altura).toBeGreaterThan(0);
    expect(p.topo).toBe(0.375);
  });

  it('o marco exatamente na meia-noite pertence ao dia que começa', () => {
    // O único caso em que tratar duração zero à parte muda a resposta: a regra
    // geral ("termina na meia-noite que abre o dia → é do dia anterior")
    // excluiria o marco de 00:00 dos **dois** dias, e ele desapareceria.
    //
    // Descoberto plantando o defeito: o teste de duração zero usava meio-dia e
    // passava com as duas implementações.
    const p = faixaNoDia({
      dia: DIA,
      fuso: SAO_PAULO,
      inicio: new Date('2026-06-15T03:00:00Z'), // meia-noite em São Paulo
      fim: new Date('2026-06-15T03:00:00Z'),
    });

    expect(p).not.toBeNull();
    expect((p as Posicao).topo).toBe(0);
  });

  it('e não pertence ao dia anterior', () => {
    expect(
      faixaNoDia({
        dia: { ano: 2026, mes: 6, dia: 14 },
        fuso: SAO_PAULO,
        inicio: new Date('2026-06-15T03:00:00Z'),
        fim: new Date('2026-06-15T03:00:00Z'),
      }),
    ).toBeNull();
  });

  describe('a virada de horário de verão', () => {
    it('num dia de 25 horas, a tarde desce menos que num dia comum', () => {
      // 1º de novembro em Nova York: 12:00 locais num dia de 25h.
      const p = faixaNoDia({
        dia: { ano: 2026, mes: 11, dia: 1 },
        fuso: NOVA_YORK,
        inicio: new Date('2026-11-01T17:00:00Z'), // 12:00 EST
        fim: new Date('2026-11-01T18:00:00Z'),
      }) as Posicao;

      // 13 horas decorridas de 25 = 0.52, e não 12/24 = 0.5.
      expect(Math.round(p.topo * 100) / 100).toBe(0.52);
      // A hora ocupa 1/25 do dia, não 1/24.
      expect(Math.round(p.altura * 10_000) / 10_000).toBe(0.04);
    });

    it('num dia de 23 horas, as 23:00 ainda caem dentro da grade', () => {
      // O defeito que a divisão por 1440 produz: num dia de 23h, 23:00 daria
      // 1380/1440 = 0.958 pela conta errada, e o fim do evento passaria de 1.
      const p = faixaNoDia({
        dia: { ano: 2026, mes: 3, dia: 8 },
        fuso: NOVA_YORK,
        inicio: new Date('2026-03-09T03:00:00Z'), // 23:00 EDT do dia 8
        fim: new Date('2026-03-09T04:00:00Z'), // a meia-noite do dia 9
      }) as Posicao;

      expect(Math.round((p.topo + p.altura) * 10_000) / 10_000).toBe(1);
    });
  });
});

describe('diasDaSemanaDe', () => {
  it('devolve sete dias', () => {
    expect(diasDaSemanaDe({ ano: 2026, mes: 6, dia: 17 }, 0)).toHaveLength(7);
  });

  it('começando no domingo', () => {
    // 17 de junho de 2026 é uma quarta; o domingo daquela semana é o dia 14.
    const dias = diasDaSemanaDe({ ano: 2026, mes: 6, dia: 17 }, 0);

    expect(dias.map((d) => d.dia)).toEqual([14, 15, 16, 17, 18, 19, 20]);
  });

  it('começando na segunda', () => {
    const dias = diasDaSemanaDe({ ano: 2026, mes: 6, dia: 17 }, 1);

    expect(dias.map((d) => d.dia)).toEqual([15, 16, 17, 18, 19, 20, 21]);
  });

  it('um domingo, com a semana começando na segunda, recua seis dias', () => {
    // O caso que exige o `+ 7` antes do módulo: aqui o início da semana (1) vem
    // **depois** do dia da semana da data (0), e o resto negativo do JavaScript
    // faria a semana começar no dia seguinte à data pedida.
    //
    // 14 de junho de 2026 é um domingo: a semana dele vai de 8 a 14.
    const dias = diasDaSemanaDe({ ano: 2026, mes: 6, dia: 14 }, 1);

    expect(dias.map((d) => d.dia)).toEqual([8, 9, 10, 11, 12, 13, 14]);
  });

  it('atravessa a virada do mês', () => {
    // 1º de julho de 2026 é uma quarta: a semana pega o fim de junho.
    const dias = diasDaSemanaDe({ ano: 2026, mes: 7, dia: 1 }, 0);

    expect(dias[0]).toEqual({ ano: 2026, mes: 6, dia: 28 });
    expect(dias[6]).toEqual({ ano: 2026, mes: 7, dia: 4 });
  });

  it('atravessa a virada do ano', () => {
    const dias = diasDaSemanaDe({ ano: 2027, mes: 1, dia: 1 }, 0);

    expect(dias[0]).toEqual({ ano: 2026, mes: 12, dia: 27 });
  });

  it('recusa início de semana que não existe', () => {
    expect(() => diasDaSemanaDe({ ano: 2026, mes: 6, dia: 17 }, 7)).toThrow(
      /semana/i,
    );
  });
});

describe('intervaloDosDias', () => {
  it('cobre a semana inteira, com fim exclusivo', () => {
    const dias = diasDaSemanaDe({ ano: 2026, mes: 6, dia: 17 }, 0);

    const { de, ate } = intervaloDosDias(dias, SAO_PAULO);

    // São Paulo é UTC-3: meia-noite local do dia 14 é 03:00Z do dia 14.
    expect(de.toISOString()).toBe('2026-06-14T03:00:00.000Z');
    expect(ate.toISOString()).toBe('2026-06-21T03:00:00.000Z');
  });

  it('um dia só cobre exatamente aquele dia', () => {
    const { de, ate } = intervaloDosDias(
      [{ ano: 2026, mes: 6, dia: 15 }],
      SAO_PAULO,
    );

    expect(de.toISOString()).toBe('2026-06-15T03:00:00.000Z');
    expect(ate.toISOString()).toBe('2026-06-16T03:00:00.000Z');
  });

  it('o dia de 25 horas tem o intervalo de 25 horas', () => {
    // O intervalo sai da conversão de hora de parede, então ele acompanha a
    // virada sozinho. Fixar 24h aqui deixaria a última hora do dia fora da
    // consulta.
    const { de, ate } = intervaloDosDias(
      [{ ano: 2026, mes: 11, dia: 1 }],
      NOVA_YORK,
    );

    expect((ate.getTime() - de.getTime()) / 3_600_000).toBe(25);
  });

  it('recusa lista vazia', () => {
    expect(() => intervaloDosDias([], SAO_PAULO)).toThrow(/vazia/i);
  });
});

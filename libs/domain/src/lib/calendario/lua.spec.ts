import {
  caminhoDaLua,
  faseDaLua,
  faseDoDia,
  iluminacao,
  ladoIluminado,
  nomeDaFase,
} from './lua';

/** A menor distância entre duas fases, no círculo: 0,99 e 0,01 estão a 0,02. */
function distancia(a: number, b: number): number {
  const d = Math.abs(a - b) % 1;
  return Math.min(d, 1 - d);
}

const DIA_EM_FASE = 1 / 29.530588853;

describe('faseDaLua', () => {
  it('a lua nova de referência (6 de janeiro de 2000, 18h14 UTC) é a fase 0', () => {
    const fase = faseDaLua(new Date('2000-01-06T18:14:00.000Z'));

    expect(distancia(fase, 0)).toBeLessThan(0.001);
  });

  // Fases reais de 2024, com a tolerância de um modelo simples (um dia).
  it.each([
    ['lua nova', '2024-01-11T11:57:00.000Z', 0],
    ['quarto crescente', '2024-01-18T03:53:00.000Z', 0.25],
    ['lua cheia', '2024-01-25T17:54:00.000Z', 0.5],
    ['quarto minguante', '2024-02-02T23:18:00.000Z', 0.75],
    ['a lua nova seguinte', '2024-02-09T22:59:00.000Z', 0],
  ])('acerta a %s em um dia', (_nome, instante, esperada) => {
    const fase = faseDaLua(new Date(instante));

    expect(distancia(fase, esperada)).toBeLessThan(DIA_EM_FASE);
  });

  it('fica sempre entre 0 (inclusive) e 1 (exclusive), até antes da referência', () => {
    for (const ano of [1950, 1990, 1999, 2000, 2026, 2100]) {
      for (let mes = 0; mes < 12; mes++) {
        const fase = faseDaLua(new Date(Date.UTC(ano, mes, 15, 12)));

        expect(fase).toBeGreaterThanOrEqual(0);
        expect(fase).toBeLessThan(1);
      }
    }
  });

  it('avança cerca de 1/29,5 por dia', () => {
    const a = faseDaLua(new Date('2026-06-10T12:00:00.000Z'));
    const b = faseDaLua(new Date('2026-06-11T12:00:00.000Z'));

    expect(distancia(b, a)).toBeCloseTo(DIA_EM_FASE, 3);
    // E avança, não recua.
    expect((b - a + 1) % 1).toBeCloseTo(DIA_EM_FASE, 3);
  });

  it('volta à mesma fase depois de um mês sinódico', () => {
    const a = faseDaLua(new Date('2026-03-01T00:00:00.000Z'));
    const b = faseDaLua(
      new Date(
        new Date('2026-03-01T00:00:00.000Z').getTime() +
          29.530588853 * 86_400_000,
      ),
    );

    expect(distancia(a, b)).toBeLessThan(0.001);
  });
});

describe('faseDoDia', () => {
  it('avalia a fase ao meio-dia (UTC) do dia civil', () => {
    expect(faseDoDia({ ano: 2026, mes: 11, dia: 19 })).toBe(
      faseDaLua(new Date(Date.UTC(2026, 10, 19, 12))),
    );
  });

  it('dias seguidos têm fases seguidas', () => {
    const a = faseDoDia({ ano: 2026, mes: 11, dia: 19 });
    const b = faseDoDia({ ano: 2026, mes: 11, dia: 20 });

    expect(distancia(a, b)).toBeCloseTo(DIA_EM_FASE, 3);
  });
});

describe('iluminacao', () => {
  it.each([
    [0, 0],
    [0.25, 50],
    [0.5, 100],
    [0.75, 50],
    [0.1, 10],
    [0.9, 10],
  ])('a fase %s está %s% iluminada', (fase, esperada) => {
    expect(iluminacao(fase)).toBe(esperada);
  });

  it('é inteira, entre 0 e 100', () => {
    for (let i = 0; i < 100; i++) {
      const pct = iluminacao(i / 100);

      expect(Number.isInteger(pct)).toBe(true);
      expect(pct).toBeGreaterThanOrEqual(0);
      expect(pct).toBeLessThanOrEqual(100);
    }
  });
});

describe('nomeDaFase', () => {
  it.each([
    [0, 'Lua nova'],
    [0.02, 'Lua nova'],
    [0.98, 'Lua nova'],
    [0.1, 'Crescente'],
    [0.25, 'Quarto crescente'],
    [0.4, 'Gibosa crescente'],
    [0.5, 'Lua cheia'],
    [0.6, 'Gibosa minguante'],
    [0.75, 'Quarto minguante'],
    [0.9, 'Minguante'],
  ])('a fase %s se chama "%s"', (fase, nome) => {
    expect(nomeDaFase(fase)).toBe(nome);
  });

  // Os dois lados de cada fronteira: um limite deslocado muda o nome de dias
  // inteiros do mês e só aparece aqui, não no meio de cada fase.
  it.each([
    [0.029, 'Lua nova'],
    [0.031, 'Crescente'],
    [0.219, 'Crescente'],
    [0.221, 'Quarto crescente'],
    [0.279, 'Quarto crescente'],
    [0.281, 'Gibosa crescente'],
    [0.469, 'Gibosa crescente'],
    [0.471, 'Lua cheia'],
    [0.529, 'Lua cheia'],
    [0.531, 'Gibosa minguante'],
    [0.719, 'Gibosa minguante'],
    [0.721, 'Quarto minguante'],
    [0.779, 'Quarto minguante'],
    [0.781, 'Minguante'],
    [0.969, 'Minguante'],
    [0.971, 'Lua nova'],
  ])('na fronteira, a fase %s se chama "%s"', (fase, nome) => {
    expect(nomeDaFase(fase)).toBe(nome);
  });

  it('cada fase do mês tem um nome, e as oito aparecem', () => {
    const nomes = new Set<string>();
    for (let i = 0; i < 300; i++) {
      nomes.add(nomeDaFase(i / 300));
    }

    expect(nomes.size).toBe(8);
  });
});

describe('ladoIluminado', () => {
  it('no sul, a crescente é iluminada à esquerda e a minguante à direita', () => {
    expect(ladoIluminado(0.1, 'sul')).toBe('esquerda');
    expect(ladoIluminado(0.4, 'sul')).toBe('esquerda');
    expect(ladoIluminado(0.6, 'sul')).toBe('direita');
    expect(ladoIluminado(0.9, 'sul')).toBe('direita');
  });

  it('no norte é o contrário', () => {
    expect(ladoIluminado(0.1, 'norte')).toBe('direita');
    expect(ladoIluminado(0.4, 'norte')).toBe('direita');
    expect(ladoIluminado(0.6, 'norte')).toBe('esquerda');
    expect(ladoIluminado(0.9, 'norte')).toBe('esquerda');
  });
});

describe('caminhoDaLua', () => {
  // O desenho é a parte iluminada: um arco do contorno e a elipse do terminador.
  it('crescente no sul: contorno pela esquerda, terminador curvo para dentro', () => {
    expect(caminhoDaLua(0.1, 10, 'sul')).toBe(
      'M0 -10 A10 10 0 0 0 0 10 A8.09 10 0 0 1 0 -10Z',
    );
  });

  it('gibosa crescente no sul: o terminador se abre para o lado escuro', () => {
    expect(caminhoDaLua(0.4, 10, 'sul')).toBe(
      'M0 -10 A10 10 0 0 0 0 10 A8.09 10 0 0 0 0 -10Z',
    );
  });

  it('gibosa minguante no sul: contorno pela direita', () => {
    expect(caminhoDaLua(0.6, 10, 'sul')).toBe(
      'M0 -10 A10 10 0 0 1 0 10 A8.09 10 0 0 1 0 -10Z',
    );
  });

  it('minguante no sul: contorno pela direita, terminador para dentro', () => {
    expect(caminhoDaLua(0.9, 10, 'sul')).toBe(
      'M0 -10 A10 10 0 0 1 0 10 A8.09 10 0 0 0 0 -10Z',
    );
  });

  it('no norte, o desenho é o espelho do desenho do sul', () => {
    // A crescente do norte é a minguante do sul, desenhada igual.
    expect(caminhoDaLua(0.1, 10, 'norte')).toBe(caminhoDaLua(0.9, 10, 'sul'));
    expect(caminhoDaLua(0.4, 10, 'norte')).toBe(caminhoDaLua(0.6, 10, 'sul'));
  });

  it('a lua nova não tem área iluminada: o terminador coincide com o contorno', () => {
    expect(caminhoDaLua(0, 10, 'sul')).toBe(
      'M0 -10 A10 10 0 0 0 0 10 A10 10 0 0 1 0 -10Z',
    );
  });

  it('a lua cheia é o disco inteiro: o terminador passa pelo lado escuro e coincide', () => {
    expect(caminhoDaLua(0.5, 10, 'sul')).toBe(
      'M0 -10 A10 10 0 0 1 0 10 A10 10 0 0 1 0 -10Z',
    );
  });

  it('o quarto tem terminador reto (largura zero)', () => {
    expect(caminhoDaLua(0.25, 10, 'sul')).toContain('A0 10');
  });

  it('o raio escala o desenho', () => {
    expect(caminhoDaLua(0.1, 20, 'sul')).toBe(
      'M0 -20 A20 20 0 0 0 0 20 A16.18 20 0 0 1 0 -20Z',
    );
  });
});

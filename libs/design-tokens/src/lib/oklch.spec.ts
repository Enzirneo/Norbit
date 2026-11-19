import { hexParaOklch, oklchParaHex } from './oklch';

describe('oklch', () => {
  it('branco e preto são os extremos de claridade, sem croma', () => {
    const branco = hexParaOklch('#ffffff');
    const preto = hexParaOklch('#000000');

    expect(branco.l).toBeCloseTo(1, 3);
    expect(branco.c).toBeCloseTo(0, 3);
    expect(preto.l).toBeCloseTo(0, 3);
    expect(preto.c).toBeCloseTo(0, 3);
  });

  it('bate com os valores de referência de Ottosson para o vermelho puro', () => {
    const vermelho = hexParaOklch('#ff0000');

    expect(vermelho.l).toBeCloseTo(0.628, 2);
    expect(vermelho.c).toBeCloseTo(0.2577, 2);
    expect(vermelho.h).toBeCloseTo(29.23, 0);
  });

  it('aceita a forma curta e maiúsculas', () => {
    expect(hexParaOklch('#FFF')).toEqual(hexParaOklch('#ffffff'));
  });

  it('recusa o que não é hexadecimal', () => {
    expect(() => hexParaOklch('azul')).toThrow(/hexadecimal/);
  });

  it.each([
    '#6d7cff',
    '#0b0d17',
    '#4adebb',
    '#ffb357',
    '#ff6b8a',
    '#a97bff',
    '#f6f1ea',
    '#808080',
  ])('ida e volta devolve a mesma cor: %s', (hex) => {
    expect(oklchParaHex(hexParaOklch(hex))).toBe(hex);
  });

  it('uma cor fora da gama perde croma, e não vira outra cor', () => {
    const fora = { l: 0.7, c: 0.4, h: 150 };

    const hex = oklchParaHex(fora);
    const volta = hexParaOklch(hex);

    expect(hex).toMatch(/^#[0-9a-f]{6}$/);
    expect(volta.c).toBeLessThan(fora.c);
    expect(Math.abs(volta.h - fora.h)).toBeLessThan(5);
    expect(volta.l).toBeCloseTo(fora.l, 1);
  });

  it('claridade fora de 0 a 1 é limitada', () => {
    expect(oklchParaHex({ l: 1.4, c: 0, h: 0 })).toBe('#ffffff');
    expect(oklchParaHex({ l: -0.2, c: 0, h: 0 })).toBe('#000000');
  });
});

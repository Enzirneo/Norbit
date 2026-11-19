import {
  CANTOS_MAXIMO,
  CANTOS_MINIMO,
  FORMA_DERIVADA,
  FORMA_PADRAO,
  MULTIPLICADORES_DE_RAIO,
  tokensDeForma,
} from './forma';

describe('FORMA_PADRAO', () => {
  it('abre com cantos de 6px e o campo de estrelas ligado', () => {
    expect(FORMA_PADRAO).toEqual({ cantos: 6, estrelas: true });
  });

  it('o padrão está dentro da faixa que a pessoa pode escolher', () => {
    expect(FORMA_PADRAO.cantos).toBeGreaterThanOrEqual(CANTOS_MINIMO);
    expect(FORMA_PADRAO.cantos).toBeLessThanOrEqual(CANTOS_MAXIMO);
  });
});

describe('tokensDeForma', () => {
  it('traduz os cantos em `--r`, em pixels', () => {
    expect(tokensDeForma({ cantos: 10, estrelas: true })['--r']).toBe('10px');
  });

  it('aceita os dois extremos da faixa', () => {
    expect(tokensDeForma({ cantos: 0, estrelas: true })['--r']).toBe('0px');
    expect(tokensDeForma({ cantos: 16, estrelas: true })['--r']).toBe('16px');
  });

  it('traduz as estrelas em 1 ou 0, que é o que o CSS multiplica', () => {
    expect(tokensDeForma({ cantos: 6, estrelas: true })['--estrelas']).toBe(
      '1',
    );
    expect(tokensDeForma({ cantos: 6, estrelas: false })['--estrelas']).toBe(
      '0',
    );
  });

  it('só devolve o que a pessoa escolhe: o resto deriva de `--r` no CSS', () => {
    expect(Object.keys(tokensDeForma(FORMA_PADRAO)).sort()).toEqual([
      '--estrelas',
      '--r',
    ]);
  });

  it.each([-1, 17, 6.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'recusa cantos fora da faixa ou fracionários: %s',
    (cantos) => {
      expect(() => tokensDeForma({ cantos, estrelas: true })).toThrow(
        RangeError,
      );
    },
  );
});

describe('FORMA_DERIVADA', () => {
  it('todo raio deriva de `--r`, para um valor só mover a tela inteira', () => {
    for (const nome of [
      '--raio-p',
      '--raio-m',
      '--raio-tela',
      '--r-ev',
    ] as const) {
      expect(FORMA_DERIVADA[nome]).toContain('var(--r)');
    }
  });

  it('o evento é mais reto que a moldura, para qualquer valor de cantos', () => {
    const { evento, pequeno, medio, tela } = MULTIPLICADORES_DE_RAIO;

    expect(evento).toBeLessThan(pequeno);
    expect(pequeno).toBeLessThan(medio);
    expect(medio).toBeLessThan(tela);
  });

  it('os multiplicadores do CSS são os mesmos da constante', () => {
    expect(FORMA_DERIVADA['--r-ev']).toContain(
      String(MULTIPLICADORES_DE_RAIO.evento),
    );
    expect(FORMA_DERIVADA['--raio-m']).toContain(
      String(MULTIPLICADORES_DE_RAIO.medio),
    );
    expect(FORMA_DERIVADA['--raio-tela']).toContain(
      String(MULTIPLICADORES_DE_RAIO.tela),
    );
  });

  it('a pílula não depende dos cantos: é círculo em qualquer escolha', () => {
    expect(FORMA_DERIVADA['--raio-pilula']).toBe('9999px');
  });

  it('o alvo de toque tem um valor para o mouse e outro para o dedo', () => {
    expect(FORMA_DERIVADA['--alvo-toque']).toBe('2rem');
    expect(FORMA_DERIVADA['--alvo-toque-grosso']).toBe('2.75rem');
  });

  it('as sombras usam preto translúcido, e não uma cor do tema', () => {
    for (const nome of ['--sombra-1', '--sombra-2', '--sombra-3'] as const) {
      expect(FORMA_DERIVADA[nome]).toMatch(/rgb\(0 0 0 \/ 0\.\d+\)/);
    }
  });

  it('o brilho do destaque deriva do destaque do tema, e não de uma cor fixa', () => {
    expect(FORMA_DERIVADA['--brilho-destaque']).toContain('var(--accent)');
  });
});

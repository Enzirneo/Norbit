import { contraste, luminancia } from './contraste';

describe('luminancia', () => {
  it('dá 0 para preto e 1 para branco', () => {
    expect(luminancia('#000000')).toBeCloseTo(0, 5);
    expect(luminancia('#FFFFFF')).toBeCloseTo(1, 5);
  });

  it('aceita a notação curta e ignora a caixa', () => {
    expect(luminancia('#fff')).toBeCloseTo(luminancia('#FFFFFF'), 5);
  });

  it('recusa valor que não é cor hexadecimal', () => {
    expect(() => luminancia('azul')).toThrow(/hexadecimal/i);
  });
});

describe('contraste', () => {
  it('dá 21 entre preto e branco, o máximo possível', () => {
    expect(contraste('#000000', '#FFFFFF')).toBeCloseTo(21, 2);
  });

  it('dá 1 entre uma cor e ela mesma', () => {
    expect(contraste('#6D7CFF', '#6D7CFF')).toBeCloseTo(1, 5);
  });

  it('não depende da ordem dos argumentos', () => {
    expect(contraste('#0B0D17', '#C9CDE0')).toBeCloseTo(
      contraste('#C9CDE0', '#0B0D17'),
      5,
    );
  });

  it('confere com o valor conhecido do par que reprovou na prática', () => {
    // `dust-300` sobre `space-800` foi usado por reflexo nas primeiras telas de
    // autenticação e reprova no AA. O número está aqui para que a função não
    // passe a mentir numa refatoração.
    expect(contraste('#6E7595', '#0B0D17')).toBeCloseTo(4.28, 1);
  });
});

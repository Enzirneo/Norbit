import { MINIMO_TEXTO, contraste } from './contraste';
import { corDeAvatar } from './cor-de-avatar';
import { hexParaOklch } from './oklch';

const GRADE = [
  '#000000',
  '#ffffff',
  '#808080',
  '#6d7cff',
  '#4adebb',
  '#ffb357',
  '#ff6b8a',
  '#a97bff',
  '#ff0000',
  '#00ff00',
  '#0000ff',
  '#ffff00',
  '#767676',
  '#5a5a9a',
  '#9a5a5a',
];

describe('corDeAvatar', () => {
  it.each(GRADE)('%s: o texto se lê sobre o fundo, ao menos a 4.5:1', (cor) => {
    const { fundo, texto } = corDeAvatar(cor);

    expect(contraste(texto, fundo)).toBeGreaterThanOrEqual(MINIMO_TEXTO);
  });

  it('uma cor que já serve fica exatamente como foi escolhida', () => {
    expect(corDeAvatar('#4adebb').fundo).toBe('#4adebb');
    expect(corDeAvatar('#0b0d17').fundo).toBe('#0b0d17');
  });

  it('escolhe a frente escura sobre cor clara e a clara sobre cor escura', () => {
    const clara = corDeAvatar('#ffb357');
    const escura = corDeAvatar('#1a1a40');

    expect(hexParaOklch(clara.texto).l).toBeLessThan(0.3);
    expect(hexParaOklch(escura.texto).l).toBeGreaterThan(0.9);
  });

  it('a faixa estreita em que nenhuma frente chega a 4.5:1 é ajustada, sem mudar o matiz', () => {
    // Cinza de claridade média: o quase preto dá ~4.46:1 e o quase branco, ~4.3:1.
    const { fundo, texto } = corDeAvatar('#767676');

    expect(fundo).not.toBe('#767676');
    expect(contraste(texto, fundo)).toBeGreaterThanOrEqual(MINIMO_TEXTO);
    expect(hexParaOklch(fundo).c).toBeLessThan(0.01);
  });

  it('o ajuste é mínimo e vai para o lado certo: clareia para o texto escuro', () => {
    const original = hexParaOklch('#767676').l;
    const ajustado = hexParaOklch(corDeAvatar('#767676').fundo).l;

    // Mais claro (o texto é escuro), e por pouco: não pula para o branco.
    expect(ajustado).toBeGreaterThan(original);
    expect(ajustado - original).toBeLessThan(0.05);
  });

  it('um tom médio colorido ajustado mantém o matiz', () => {
    const original = hexParaOklch('#7a6a9a');
    const ajustado = hexParaOklch(corDeAvatar('#7a6a9a').fundo);

    expect(Math.abs(ajustado.h - original.h)).toBeLessThan(8);
  });

  it('aceita maiúsculas e a forma curta', () => {
    expect(corDeAvatar('#4ADEBB')).toEqual(corDeAvatar('#4adebb'));
    expect(corDeAvatar('#fff')).toEqual(corDeAvatar('#ffffff'));
  });

  it('é determinística', () => {
    expect(corDeAvatar('#5a8a9a')).toEqual(corDeAvatar('#5a8a9a'));
  });
});

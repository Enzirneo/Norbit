import { toCssVariables, toCssRule } from './css-variables';

describe('toCssVariables', () => {
  it('converte cada entrada em uma custom property com o prefixo', () => {
    const css = toCssVariables(
      { nebula: '#6D7CFF', aurora: '#4ADEBB' },
      'color',
    );

    expect(css).toBe('--color-nebula: #6D7CFF;\n--color-aurora: #4ADEBB;');
  });

  it('converte camelCase em kebab-case, porque CSS não aceita maiúsculas no nome', () => {
    const css = toCssVariables({ surfaceRaised: '#13162A' }, 'color');

    expect(css).toBe('--color-surface-raised: #13162A;');
  });

  it('separa o degrau numérico do nome: space900 vira space-900', () => {
    const css = toCssVariables(
      { space900: '#070812', dust000: '#F4F5FA' },
      'color',
    );

    expect(css).toBe('--color-space-900: #070812;\n--color-dust-000: #F4F5FA;');
  });

  it('aceita valores numéricos, usados em espaçamento e densidade', () => {
    const css = toCssVariables({ unit: 4 }, 'space');

    expect(css).toBe('--space-unit: 4;');
  });

  it('devolve string vazia para um conjunto vazio, sem sobrar quebra de linha', () => {
    expect(toCssVariables({}, 'color')).toBe('');
  });

  it('rejeita prefixo vazio: uma variável "--nebula" colidiria entre camadas', () => {
    expect(() => toCssVariables({ nebula: '#6D7CFF' }, '')).toThrow(
      'O prefixo do token não pode ser vazio',
    );
  });
});

describe('toCssRule', () => {
  it('envolve as variáveis num seletor, pronto para injetar na página', () => {
    const rule = toCssRule(':root', { nebula: '#6D7CFF' }, 'color');

    expect(rule).toBe(':root {\n  --color-nebula: #6D7CFF;\n}');
  });

  it('indenta todas as linhas de um conjunto com mais de um token', () => {
    const rule = toCssRule(':root', { a: '#000', b: '#fff' }, 'color');

    expect(rule).toBe(':root {\n  --color-a: #000;\n  --color-b: #fff;\n}');
  });
});

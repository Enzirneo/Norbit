import { iniciaisDe } from './iniciais';

describe('iniciaisDe', () => {
  it('usa a primeira letra do primeiro e do último nome', () => {
    expect(iniciaisDe('Enzo Bispo')).toBe('EB');
  });

  it('ignora nomes do meio e espaços sobrando', () => {
    expect(iniciaisDe('  ana   maria  de souza ')).toBe('AS');
  });

  it('com um nome só, devolve uma letra', () => {
    expect(iniciaisDe('enzo')).toBe('E');
  });

  it('não parte um caractere fora do plano básico ao meio', () => {
    expect(iniciaisDe('😀 Joe')).toBe('😀J');
  });

  it('devolve um marcador quando não há nome', () => {
    expect(iniciaisDe('   ')).toBe('?');
  });
});

import { ehSementes } from './sementes';
import { FUNDOS_PRONTOS, TEMAS_PRONTOS } from './temas-prontos';

describe('temas prontos', () => {
  it('oferece nebula, eclipse, dawn e vacuum', () => {
    expect(Object.keys(TEMAS_PRONTOS)).toEqual([
      'nebula',
      'eclipse',
      'dawn',
      'vacuum',
    ]);
  });

  it('o nebula é exatamente o tema padrão de hoje', () => {
    expect(TEMAS_PRONTOS.nebula).toEqual({
      fundo: '#0b0d17',
      destaque: '#6d7cff',
      contraste: 'normal',
    });
  });

  it('todos são sementes válidas, e o dawn é o claro', () => {
    for (const sementes of Object.values(TEMAS_PRONTOS)) {
      expect(ehSementes(sementes)).toBe(true);
    }
    expect(TEMAS_PRONTOS.dawn.fundo).toMatch(/^#f/);
  });

  it('os fundos prontos são Noite, Vazio, Aurora e Eclipse, em hexadecimal', () => {
    expect(Object.keys(FUNDOS_PRONTOS)).toEqual([
      'noite',
      'vazio',
      'aurora',
      'eclipse',
    ]);
    for (const fundo of Object.values(FUNDOS_PRONTOS)) {
      expect(fundo).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

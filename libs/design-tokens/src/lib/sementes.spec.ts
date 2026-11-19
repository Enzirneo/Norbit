import { ehSementes, modoDe, normalizarHex } from './sementes';

describe('sementes', () => {
  describe('normalizarHex', () => {
    it('põe em minúsculas e expande a forma curta', () => {
      expect(normalizarHex('#ABC')).toBe('#aabbcc');
      expect(normalizarHex('#6D7CFF')).toBe('#6d7cff');
    });

    it('recusa o que não é uma cor', () => {
      expect(() => normalizarHex('6d7cff')).toThrow();
      expect(() => normalizarHex('#12345')).toThrow();
    });
  });

  describe('modoDe', () => {
    it('um fundo escuro dá o modo escuro, e um claro, o claro', () => {
      expect(modoDe('#0b0d17')).toBe('escuro');
      expect(modoDe('#f6f1ea')).toBe('claro');
    });

    it('o corte é na claridade perceptual, não no brilho ingênuo', () => {
      // Um azul médio é "escuro" para o olho, apesar do canal azul alto.
      expect(modoDe('#3050d0')).toBe('escuro');
      expect(modoDe('#c0c0c0')).toBe('claro');
    });
  });

  describe('ehSementes', () => {
    const valida = {
      fundo: '#0b0d17',
      destaque: '#6d7cff',
      contraste: 'normal',
    };

    it('aceita sementes bem formadas', () => {
      expect(ehSementes(valida)).toBe(true);
      expect(ehSementes({ ...valida, contraste: 'alto' })).toBe(true);
    });

    it.each([
      ['nulo', null],
      ['texto', 'nebula'],
      ['sem destaque', { fundo: '#0b0d17', contraste: 'normal' }],
      ['hex inválido', { ...valida, fundo: 'preto' }],
      ['contraste desconhecido', { ...valida, contraste: 'medio' }],
    ])('recusa: %s', (_nome, valor) => {
      expect(ehSementes(valor)).toBe(false);
    });
  });
});

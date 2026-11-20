import { TEMA_PADRAO, temaSchema } from './tema';

const VALIDO = {
  v: 1,
  base: 'nebula',
  sementes: { fundo: '#0b0d17', destaque: '#6d7cff', contraste: 'normal' },
  forma: { cantos: 6, estrelas: true, lua: true, hemisferio: 'sul' },
};

describe('temaSchema', () => {
  it('aceita o tema padrão, e base pode ser nula (sementes editadas à mão)', () => {
    expect(temaSchema.safeParse(VALIDO).success).toBe(true);
    expect(temaSchema.safeParse({ ...VALIDO, base: null }).success).toBe(true);
    expect(temaSchema.safeParse(TEMA_PADRAO).success).toBe(true);
  });

  it('põe as cores em minúsculas, como o resto dos contratos', () => {
    const lido = temaSchema.parse({
      ...VALIDO,
      sementes: { ...VALIDO.sementes, fundo: '#0B0D17' },
    });

    expect(lido.sementes.fundo).toBe('#0b0d17');
  });

  it('ignora o campo reservado `ajustes` e qualquer outro desconhecido', () => {
    const lido = temaSchema.parse({ ...VALIDO, ajustes: { x: 1 }, extra: 2 });

    expect(lido).not.toHaveProperty('ajustes');
    expect(lido).not.toHaveProperty('extra');
  });

  it.each([
    ['versão desconhecida', { ...VALIDO, v: 2 }],
    ['base desconhecida', { ...VALIDO, base: 'galaxia' }],
    [
      'fundo que não é hex',
      { ...VALIDO, sementes: { ...VALIDO.sementes, fundo: 'preto' } },
    ],
    [
      'destaque curto',
      { ...VALIDO, sementes: { ...VALIDO.sementes, destaque: '#fff' } },
    ],
    [
      'contraste desconhecido',
      { ...VALIDO, sementes: { ...VALIDO.sementes, contraste: 'medio' } },
    ],
    [
      'cantos acima de 16',
      { ...VALIDO, forma: { ...VALIDO.forma, cantos: 17 } },
    ],
    ['cantos negativos', { ...VALIDO, forma: { ...VALIDO.forma, cantos: -1 } }],
    [
      'cantos fracionários',
      { ...VALIDO, forma: { ...VALIDO.forma, cantos: 1.5 } },
    ],
    [
      'hemisfério desconhecido',
      { ...VALIDO, forma: { ...VALIDO.forma, hemisferio: 'leste' } },
    ],
    ['sem forma', { v: 1, base: null, sementes: VALIDO.sementes }],
  ])('recusa: %s', (_nome, valor) => {
    expect(temaSchema.safeParse(valor).success).toBe(false);
  });

  it('aceita as pontas de cantos: 0 e 16', () => {
    for (const cantos of [0, 16]) {
      expect(
        temaSchema.safeParse({ ...VALIDO, forma: { ...VALIDO.forma, cantos } })
          .success,
      ).toBe(true);
    }
  });
});

describe('TEMA_PADRAO', () => {
  it('é o nebula com a forma padrão', () => {
    expect(TEMA_PADRAO).toEqual(VALIDO);
  });
});

import { apagarContaSchema } from './apagar-conta';

describe('apagarContaSchema', () => {
  it('aceita a senha', () => {
    expect(apagarContaSchema.parse({ senha: 'qualquer' })).toEqual({
      senha: 'qualquer',
    });
  });

  it('recusa a senha vazia', () => {
    expect(apagarContaSchema.safeParse({ senha: '' }).success).toBe(false);
  });

  it('recusa sem a senha', () => {
    expect(apagarContaSchema.safeParse({}).success).toBe(false);
  });

  it('não impõe a política de tamanho mínimo, só um teto', () => {
    expect(apagarContaSchema.safeParse({ senha: 'a' }).success).toBe(true);
    expect(
      apagarContaSchema.safeParse({ senha: 'a'.repeat(201) }).success,
    ).toBe(false);
  });

  it('descarta campos desconhecidos', () => {
    expect(apagarContaSchema.parse({ senha: 'x', extra: 1 })).toEqual({
      senha: 'x',
    });
  });
});

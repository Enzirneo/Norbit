import { confirmarEmailSchema, trocarEmailSchema } from './troca-de-email';

describe('trocarEmailSchema', () => {
  it('aceita a senha e um e-mail válido, normalizando o e-mail', () => {
    const r = trocarEmailSchema.parse({
      senha: 'qualquer',
      novoEmail: '  Novo@Norbit.DEV ',
    });

    expect(r).toEqual({ senha: 'qualquer', novoEmail: 'novo@norbit.dev' });
  });

  it('recusa um e-mail inválido', () => {
    const r = trocarEmailSchema.safeParse({
      senha: 'qualquer',
      novoEmail: 'sem-arroba',
    });

    expect(r.success).toBe(false);
  });

  it('recusa sem a senha', () => {
    expect(trocarEmailSchema.safeParse({ novoEmail: 'a@b.co' }).success).toBe(
      false,
    );
    expect(
      trocarEmailSchema.safeParse({ senha: '', novoEmail: 'a@b.co' }).success,
    ).toBe(false);
  });

  it('não impõe a política de tamanho à senha, só um teto', () => {
    const base = { novoEmail: 'a@b.co' };

    expect(trocarEmailSchema.safeParse({ ...base, senha: 'a' }).success).toBe(
      true,
    );
    expect(
      trocarEmailSchema.safeParse({ ...base, senha: 'a'.repeat(201) }).success,
    ).toBe(false);
  });
});

describe('confirmarEmailSchema', () => {
  it('aceita um token', () => {
    expect(confirmarEmailSchema.parse({ token: 'abc' })).toEqual({
      token: 'abc',
    });
  });

  it('recusa token vazio ou absurdamente longo', () => {
    expect(confirmarEmailSchema.safeParse({ token: '' }).success).toBe(false);
    expect(
      confirmarEmailSchema.safeParse({ token: 'a'.repeat(201) }).success,
    ).toBe(false);
  });
});

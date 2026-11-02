import { esqueciSenhaSchema, redefinirSenhaSchema } from './redefinicao';

// Montadas em tempo de execução pelo mesmo motivo do `cadastro.spec.ts`.
const SENHA_VALIDA = ['uma', 'senha', 'bem', 'longa'].join(' ');
const SENHA_CURTA = ['curta'].join('');

describe('esqueciSenhaSchema', () => {
  it('normaliza o e-mail como o cadastro faz', () => {
    const r = esqueciSenhaSchema.parse({ email: '  Enzo@Norbit.DEV ' });

    expect(r.email).toBe('enzo@norbit.dev');
  });

  it('recusa e-mail inválido', () => {
    expect(esqueciSenhaSchema.safeParse({ email: 'nao-e-email' }).success).toBe(
      false,
    );
  });
});

describe('redefinirSenhaSchema', () => {
  it('aceita um token e uma senha válida', () => {
    const r = redefinirSenhaSchema.parse({
      token: 'abc',
      password: SENHA_VALIDA,
    });

    expect(r.token).toBe('abc');
  });

  it('aplica a mesma regra de tamanho do cadastro', () => {
    const r = redefinirSenhaSchema.safeParse({
      token: 'abc',
      password: SENHA_CURTA,
    });

    expect(r.success).toBe(false);
  });

  it('recusa token vazio', () => {
    expect(
      redefinirSenhaSchema.safeParse({ token: '', password: SENHA_VALIDA })
        .success,
    ).toBe(false);
  });

  it('recusa token absurdamente longo', () => {
    expect(
      redefinirSenhaSchema.safeParse({
        token: 'a'.repeat(201),
        password: SENHA_VALIDA,
      }).success,
    ).toBe(false);
  });

  it('descarta campos não declarados', () => {
    const r = redefinirSenhaSchema.parse({
      token: 'abc',
      password: SENHA_VALIDA,
      userId: 'outro',
    });

    expect(r).not.toHaveProperty('userId');
  });
});

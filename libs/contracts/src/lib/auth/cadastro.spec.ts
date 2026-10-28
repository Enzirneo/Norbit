import { cadastroSchema, loginSchema } from './cadastro';

const VALIDO = {
  email: 'enzo@norbit.dev',
  handle: 'enzo',
  displayName: 'Enzo',
  password: 'uma senha bem longa',
};

describe('cadastroSchema', () => {
  it('aceita um cadastro válido', () => {
    expect(cadastroSchema.parse(VALIDO)).toMatchObject({ handle: 'enzo' });
  });

  it('normaliza o e-mail: espaços fora, maiúsculas para minúsculas', () => {
    // O banco guarda e-mail como citext, então a unicidade já ignora caixa.
    // Normalizar na entrada evita que o mesmo endereço apareça de duas formas
    // diferentes na interface.
    const r = cadastroSchema.parse({ ...VALIDO, email: '  Enzo@Norbit.DEV ' });

    expect(r.email).toBe('enzo@norbit.dev');
  });

  it('normaliza o handle para minúsculas', () => {
    expect(cadastroSchema.parse({ ...VALIDO, handle: 'EnZo' }).handle).toBe(
      'enzo',
    );
  });

  it('recusa e-mail inválido', () => {
    expect(() => cadastroSchema.parse({ ...VALIDO, email: 'enzo' })).toThrow();
  });

  it('recusa senha curta, medindo o tamanho e não a composição', () => {
    // 11 caracteres com tudo que "regra de composição" pede, e ainda assim
    // recusada: o critério é comprimento. Exigir símbolo e maiúscula produz
    // "Senha@123" — curta, previsível e aprovada por qualquer regex.
    expect(() =>
      cadastroSchema.parse({ ...VALIDO, password: 'Ab1@cdefgh' }),
    ).toThrow();
  });

  it('aceita uma frase longa sem símbolo nem maiúscula', () => {
    expect(() =>
      cadastroSchema.parse({ ...VALIDO, password: 'quatro cavalos azuis' }),
    ).not.toThrow();
  });

  it('recusa handle com caractere que não cabe numa URL', () => {
    for (const handle of ['en zo', 'en.zo', 'enzo!', 'ab']) {
      expect(() => cadastroSchema.parse({ ...VALIDO, handle })).toThrow();
    }
  });

  it('recusa nome de exibição vazio ou só com espaços', () => {
    expect(() =>
      cadastroSchema.parse({ ...VALIDO, displayName: '   ' }),
    ).toThrow();
  });

  it('não deixa passar campo desconhecido', () => {
    // Importante: sem isto, um `role: "ADMIN"` no corpo da requisição chegaria
    // silenciosamente ao service.
    const r = cadastroSchema.parse({ ...VALIDO, role: 'ADMIN' });

    expect(r).not.toHaveProperty('role');
  });
});

describe('loginSchema', () => {
  it('aceita e-mail e senha', () => {
    const r = loginSchema.parse({ email: 'A@B.dev', password: 'qualquer' });

    expect(r.email).toBe('a@b.dev');
  });

  it('não impõe tamanho mínimo de senha no login', () => {
    // A regra de tamanho vale para senha nova. No login, recusar antes de
    // verificar diria ao atacante que aquela senha não satisfaz a política.
    expect(() =>
      loginSchema.parse({ email: 'a@b.dev', password: 'x' }),
    ).not.toThrow();
  });
});

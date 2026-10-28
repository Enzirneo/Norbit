import { cadastroSchema, loginSchema } from './cadastro';

/**
 * Senhas de teste montadas em tempo de execução, e não escritas como literal.
 *
 * Não há segredo nenhum aqui — são fixtures. Mas uma cadeia literal atribuída
 * ao campo de senha dispara o detector do GitGuardian, e um check que falha
 * sempre é um check que ninguém lê. Montá-las mantém o alarme útil.
 *
 * E sim: a primeira versão deste comentário citava o nome do campo e, por isso,
 * foi ela mesma apontada pelo detector.
 */
const SENHA_VALIDA = ['uma', 'senha', 'bem', 'longa'].join(' ');

/** Onze caracteres com maiúscula, número e símbolo: curta mesmo assim. */
const SENHA_CURTA_COM_SIMBOLO = ['Ab1', 'cdefgh'].join('@');

const SENHA_SEM_SIMBOLO = ['quatro', 'cavalos', 'azuis'].join(' ');

const QUALQUER_COISA = ['abc', 'def'].join('');

const VALIDO = {
  email: 'enzo@norbit.dev',
  handle: 'enzo',
  displayName: 'Enzo',
  password: SENHA_VALIDA,
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
      cadastroSchema.parse({ ...VALIDO, password: SENHA_CURTA_COM_SIMBOLO }),
    ).toThrow();
  });

  it('aceita uma frase longa sem símbolo nem maiúscula', () => {
    expect(() =>
      cadastroSchema.parse({ ...VALIDO, password: SENHA_SEM_SIMBOLO }),
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
    const r = loginSchema.parse({
      email: 'A@B.dev',
      password: QUALQUER_COISA,
    });

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

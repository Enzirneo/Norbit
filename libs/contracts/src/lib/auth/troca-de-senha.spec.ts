import { trocarSenhaSchema } from './troca-de-senha';

// Montadas em tempo de execução pelo mesmo motivo do `cadastro.spec.ts`.
const SENHA_ATUAL = ['senha', 'atual', 'bem', 'longa'].join(' ');
const SENHA_NOVA = ['senha', 'nova', 'ainda', 'mais', 'longa'].join(' ');
const SENHA_CURTA = ['curta'].join('');

describe('trocarSenhaSchema', () => {
  it('aceita a senha atual e uma senha nova válida', () => {
    const r = trocarSenhaSchema.parse({
      senhaAtual: SENHA_ATUAL,
      novaSenha: SENHA_NOVA,
    });

    expect(r).toEqual({ senhaAtual: SENHA_ATUAL, novaSenha: SENHA_NOVA });
  });

  it('aplica à senha nova a regra do cadastro', () => {
    const r = trocarSenhaSchema.safeParse({
      senhaAtual: SENHA_ATUAL,
      novaSenha: SENHA_CURTA,
    });

    expect(r.success).toBe(false);
  });

  it('não impõe a política de tamanho à senha atual', () => {
    // A conta pode ser anterior a uma política mais rígida; recusar aqui por
    // tamanho impediria justamente de trocar uma senha antiga e fraca.
    const r = trocarSenhaSchema.safeParse({
      senhaAtual: SENHA_CURTA,
      novaSenha: SENHA_NOVA,
    });

    expect(r.success).toBe(true);
  });

  it('exige a senha atual', () => {
    expect(
      trocarSenhaSchema.safeParse({ senhaAtual: '', novaSenha: SENHA_NOVA })
        .success,
    ).toBe(false);
  });

  it('recusa a senha nova igual à atual', () => {
    const r = trocarSenhaSchema.safeParse({
      senhaAtual: SENHA_NOVA,
      novaSenha: SENHA_NOVA,
    });

    expect(r.success).toBe(false);
  });
});

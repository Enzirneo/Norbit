import { atualizarPerfilSchema } from './perfil';

describe('atualizarPerfilSchema', () => {
  it('aceita alterar só um campo', () => {
    expect(atualizarPerfilSchema.parse({ displayName: ' Enzo ' })).toEqual({
      displayName: 'Enzo',
    });
  });

  it('aplica a regra de handle do cadastro, com normalização', () => {
    expect(atualizarPerfilSchema.parse({ handle: ' Enzo_B ' }).handle).toBe(
      'enzo_b',
    );
    expect(atualizarPerfilSchema.safeParse({ handle: 'a b' }).success).toBe(
      false,
    );
    expect(atualizarPerfilSchema.safeParse({ handle: 'ab' }).success).toBe(
      false,
    );
  });

  it('canoniza o fuso e recusa deslocamento fixo', () => {
    expect(
      atualizarPerfilSchema.parse({ timeZone: 'america/sao_paulo' }).timeZone,
    ).toBe('America/Sao_Paulo');
    expect(
      atualizarPerfilSchema.safeParse({ timeZone: '+03:00' }).success,
    ).toBe(false);
  });

  it('recusa nome vazio', () => {
    expect(atualizarPerfilSchema.safeParse({ displayName: '  ' }).success).toBe(
      false,
    );
  });

  it('recusa um corpo sem nenhum campo', () => {
    // Um PATCH vazio não muda nada e quase sempre é engano do cliente.
    expect(atualizarPerfilSchema.safeParse({}).success).toBe(false);
  });

  it('descarta o que não é do perfil, e-mail inclusive', () => {
    // Trocar o e-mail muda a credencial da conta: precisa de confirmação por
    // e-mail e não entra por aqui.
    const r = atualizarPerfilSchema.parse({
      displayName: 'Enzo',
      email: 'outro@norbit.dev',
      avatarUrl: 'http://x',
    });

    expect(r).toEqual({ displayName: 'Enzo' });
  });
});

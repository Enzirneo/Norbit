import { criarConviteSchema } from './convite';

describe('criarConviteSchema', () => {
  it('aceita um convite por e-mail e normaliza o endereço', () => {
    const r = criarConviteSchema.parse({
      email: '  Maria@Norbit.DEV ',
      papel: 'EDITOR',
    });

    expect(r).toMatchObject({ email: 'maria@norbit.dev', papel: 'EDITOR' });
  });

  it('aceita um convite por link, sem e-mail', () => {
    const r = criarConviteSchema.parse({ papel: 'VIEWER' });

    expect(r.email).toBeUndefined();
  });

  it('o padrão é uma semana de validade', () => {
    expect(criarConviteSchema.parse({ papel: 'VIEWER' }).validadeDias).toBe(7);
  });

  it('recusa o papel de dono: posse não se convida, se transfere', () => {
    expect(criarConviteSchema.safeParse({ papel: 'OWNER' }).success).toBe(
      false,
    );
  });

  it('exige o papel', () => {
    expect(criarConviteSchema.safeParse({}).success).toBe(false);
  });

  it.each([0, 31, 1.5, -1])('recusa validade de %s dias', (validadeDias) => {
    expect(
      criarConviteSchema.safeParse({ papel: 'VIEWER', validadeDias }).success,
    ).toBe(false);
  });

  it.each([0, 101, 1.5])('recusa %s usos', (usosMaximos) => {
    expect(
      criarConviteSchema.safeParse({ papel: 'VIEWER', usosMaximos }).success,
    ).toBe(false);
  });

  it('recusa e-mail inválido', () => {
    expect(
      criarConviteSchema.safeParse({ email: 'nao-e-email', papel: 'VIEWER' })
        .success,
    ).toBe(false);
  });

  it('descarta o que não é do convite', () => {
    // Um `status: "ACCEPTED"` ou um `useCount` no corpo nunca chega ao serviço.
    const r = criarConviteSchema.parse({
      papel: 'VIEWER',
      status: 'ACCEPTED',
      useCount: 99,
    });

    expect(r).not.toHaveProperty('status');
    expect(r).not.toHaveProperty('useCount');
  });
});

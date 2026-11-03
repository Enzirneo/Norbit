import { validarConvite, type ValoresDoConvite } from './validar-convite';

const BASE: ValoresDoConvite = {
  email: '',
  papel: 'VIEWER',
  validadeDias: 7,
  usosMaximos: null,
};

describe('validarConvite', () => {
  it('com e-mail, é um convite por e-mail', () => {
    const r = validarConvite({ ...BASE, email: 'ana@norbit.dev' });

    expect(r.success && r.data.email).toBe('ana@norbit.dev');
  });

  it('descarta o teto de usos quando há e-mail: o convite por e-mail é de um uso só', () => {
    const r = validarConvite({
      ...BASE,
      email: 'ana@norbit.dev',
      usosMaximos: 50,
    });

    expect(r.success && r.data.usosMaximos).toBeUndefined();
  });

  it('sem e-mail, é um convite por link e leva o teto de usos', () => {
    const r = validarConvite({ ...BASE, usosMaximos: 5 });

    expect(r.success).toBe(true);
    expect(r.success && r.data.email).toBeUndefined();
    expect(r.success && r.data.usosMaximos).toBe(5);
  });

  it('trata e-mail de só espaços como ausente', () => {
    const r = validarConvite({ ...BASE, email: '   ' });

    expect(r.success && r.data.email).toBeUndefined();
  });

  it('apara os espaços do e-mail', () => {
    const r = validarConvite({ ...BASE, email: '  ana@norbit.dev ' });

    expect(r.success && r.data.email).toBe('ana@norbit.dev');
  });

  it('campo de validade vazio usa o padrão do contrato', () => {
    const r = validarConvite({ ...BASE, validadeDias: null });

    expect(r.success && r.data.validadeDias).toBe(7);
  });

  it('aponta o campo do e-mail quando ele não é um e-mail', () => {
    const r = validarConvite({ ...BASE, email: 'isso não é e-mail' });

    expect(r.success).toBe(false);
    expect(!r.success && r.error.issues[0]?.path).toEqual(['email']);
  });

  it('recusa validade acima do teto de 30 dias', () => {
    const r = validarConvite({ ...BASE, validadeDias: 31 });

    expect(r.success).toBe(false);
    expect(!r.success && r.error.issues[0]?.path).toEqual(['validadeDias']);
  });
});

/**
 * A regra de aceitar um convite.
 *
 * O convite é uma credencial: quem o apresenta entra numa agenda. Por isso a
 * decisão é função pura, com um teste por motivo de recusa — cada um dá uma
 * resposta diferente a quem tem o link, e confundir dois é como se vaza acesso.
 */
import { avaliarConvite, type ConviteAvaliavel } from './convite';

const AGORA = new Date('2026-11-03T12:00:00.000Z');

function daquiADias(dias: number): Date {
  return new Date(AGORA.getTime() + dias * 86_400_000);
}

const POR_EMAIL: ConviteAvaliavel = {
  status: 'PENDING',
  email: 'maria@norbit.dev',
  expiresAt: daquiADias(7),
  maxUses: 1,
  useCount: 0,
};

const POR_LINK: ConviteAvaliavel = {
  status: 'PENDING',
  email: null,
  expiresAt: daquiADias(7),
  maxUses: 3,
  useCount: 0,
};

const MARIA = { email: 'maria@norbit.dev', jaEhMembro: false };

describe('avaliarConvite', () => {
  it('aceita o convite por e-mail para a conta desse e-mail', () => {
    expect(avaliarConvite(POR_EMAIL, MARIA, AGORA)).toEqual({
      tipo: 'aceitar',
    });
  });

  it('aceita o convite por link para qualquer conta', () => {
    const v = avaliarConvite(
      POR_LINK,
      { email: 'qualquer@x.dev', jaEhMembro: false },
      AGORA,
    );

    expect(v).toEqual({ tipo: 'aceitar' });
  });

  it('não reconhece um convite que não existe', () => {
    expect(avaliarConvite(null, MARIA, AGORA)).toEqual({
      tipo: 'desconhecido',
    });
  });

  it('recusa o convite revogado', () => {
    const v = avaliarConvite({ ...POR_EMAIL, status: 'REVOKED' }, MARIA, AGORA);

    expect(v).toEqual({ tipo: 'revogado' });
  });

  it('recusa o convite que a pessoa já recusou', () => {
    const v = avaliarConvite(
      { ...POR_EMAIL, status: 'DECLINED' },
      MARIA,
      AGORA,
    );

    expect(v).toEqual({ tipo: 'recusado' });
  });

  it('recusa o convite por e-mail já aceito', () => {
    const v = avaliarConvite(
      { ...POR_EMAIL, status: 'ACCEPTED' },
      MARIA,
      AGORA,
    );

    expect(v).toEqual({ tipo: 'ja-usado' });
  });

  it('recusa o convite vencido', () => {
    const v = avaliarConvite(
      { ...POR_EMAIL, expiresAt: daquiADias(-1) },
      MARIA,
      AGORA,
    );

    expect(v).toEqual({ tipo: 'expirado' });
  });

  it('trata a expiração como inclusiva: vencer exatamente agora já venceu', () => {
    const v = avaliarConvite({ ...POR_EMAIL, expiresAt: AGORA }, MARIA, AGORA);

    expect(v).toEqual({ tipo: 'expirado' });
  });

  it('recusa o status EXPIRED mesmo com a data no futuro', () => {
    const v = avaliarConvite({ ...POR_EMAIL, status: 'EXPIRED' }, MARIA, AGORA);

    expect(v).toEqual({ tipo: 'expirado' });
  });

  it('recusa quando o convite por e-mail é de outra conta', () => {
    // O link encaminhado não dá acesso: quem o recebeu de segunda mão não é
    // quem o dono quis convidar.
    const v = avaliarConvite(
      POR_EMAIL,
      { email: 'outra@norbit.dev', jaEhMembro: false },
      AGORA,
    );

    expect(v).toEqual({ tipo: 'email-diferente' });
  });

  it('compara o e-mail sem diferenciar caixa nem espaços', () => {
    const v = avaliarConvite(
      POR_EMAIL,
      { email: '  MARIA@Norbit.DEV ', jaEhMembro: false },
      AGORA,
    );

    expect(v).toEqual({ tipo: 'aceitar' });
  });

  it('recusa o convite por link que esgotou os usos', () => {
    const v = avaliarConvite({ ...POR_LINK, useCount: 3 }, MARIA, AGORA);

    expect(v).toEqual({ tipo: 'esgotado' });
  });

  it('aceita o último uso disponível', () => {
    const v = avaliarConvite({ ...POR_LINK, useCount: 2 }, MARIA, AGORA);

    expect(v).toEqual({ tipo: 'aceitar' });
  });

  it('sem limite de usos, nunca esgota', () => {
    const v = avaliarConvite(
      { ...POR_LINK, maxUses: null, useCount: 9_999 },
      MARIA,
      AGORA,
    );

    expect(v).toEqual({ tipo: 'aceitar' });
  });

  it('quem já é membro recebe "ja-membro", sem consumir uso', () => {
    const v = avaliarConvite(
      POR_LINK,
      { email: MARIA.email, jaEhMembro: true },
      AGORA,
    );

    expect(v).toEqual({ tipo: 'ja-membro' });
  });

  it('o convite inválido vence a condição de já ser membro', () => {
    // Um convite revogado não deve parecer "tudo certo" só porque a pessoa já
    // estava na agenda: o dono revogou, e a resposta tem de dizer isso.
    const v = avaliarConvite(
      { ...POR_LINK, status: 'REVOKED' },
      { email: MARIA.email, jaEhMembro: true },
      AGORA,
    );

    expect(v).toEqual({ tipo: 'revogado' });
  });

  it('dá precedência à revogação sobre a expiração', () => {
    const v = avaliarConvite(
      { ...POR_EMAIL, status: 'REVOKED', expiresAt: daquiADias(-3) },
      MARIA,
      AGORA,
    );

    expect(v).toEqual({ tipo: 'revogado' });
  });
});

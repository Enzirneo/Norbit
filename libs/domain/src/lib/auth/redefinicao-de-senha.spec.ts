/**
 * A regra do link de redefinição de senha.
 *
 * O link é uma credencial: quem o tem troca a senha da conta. Por isso a regra
 * é função pura, com teste antes da implementação, como a rotação de refresh.
 */
import {
  VALIDADE_DO_LINK_EM_MINUTOS,
  avaliarRedefinicao,
  expiracaoDoLink,
} from './redefinicao-de-senha';

const AGORA = new Date('2026-11-02T12:00:00.000Z');

function daquiA(minutos: number): Date {
  return new Date(AGORA.getTime() + minutos * 60_000);
}

describe('avaliarRedefinicao', () => {
  it('aceita um link vivo e nunca usado', () => {
    const decisao = avaliarRedefinicao(
      { usedAt: null, expiresAt: daquiA(10) },
      AGORA,
    );

    expect(decisao).toEqual({ tipo: 'aceitar' });
  });

  it('não reconhece um link que não corresponde a nenhum pedido', () => {
    expect(avaliarRedefinicao(null, AGORA)).toEqual({ tipo: 'desconhecido' });
  });

  it('recusa o link já usado', () => {
    const decisao = avaliarRedefinicao(
      { usedAt: daquiA(-5), expiresAt: daquiA(10) },
      AGORA,
    );

    expect(decisao).toEqual({ tipo: 'ja-usado' });
  });

  it('recusa o link expirado', () => {
    const decisao = avaliarRedefinicao(
      { usedAt: null, expiresAt: daquiA(-1) },
      AGORA,
    );

    expect(decisao).toEqual({ tipo: 'expirado' });
  });

  it('trata a expiração como inclusiva: expirar exatamente agora já venceu', () => {
    const decisao = avaliarRedefinicao(
      { usedAt: null, expiresAt: AGORA },
      AGORA,
    );

    expect(decisao).toEqual({ tipo: 'expirado' });
  });

  it('dá precedência ao uso sobre a expiração', () => {
    // Um link usado e vencido apresentado de novo continua sendo reuso: dizer
    // só "expirou" esconderia que alguém guardou o link depois de usá-lo.
    const decisao = avaliarRedefinicao(
      { usedAt: daquiA(-30), expiresAt: daquiA(-5) },
      AGORA,
    );

    expect(decisao).toEqual({ tipo: 'ja-usado' });
  });
});

describe('expiracaoDoLink', () => {
  it('vence em meia hora', () => {
    expect(VALIDADE_DO_LINK_EM_MINUTOS).toBe(30);
    expect(expiracaoDoLink(AGORA)).toEqual(daquiA(30));
  });
});

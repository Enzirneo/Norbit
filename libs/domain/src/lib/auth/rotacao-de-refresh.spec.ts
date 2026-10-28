/**
 * A decisão de rotação é a regra mais fácil de escrever errado em toda a
 * autenticação, e a mais difícil de perceber que está errada: um bug aqui não
 * quebra o login, só deixa de detectar o roubo de token. Por isso ela é função
 * pura, mora no domínio e tem teste antes de implementação.
 */
import { avaliarRotacao } from './rotacao-de-refresh';

const AGORA = new Date('2026-10-28T12:00:00.000Z');

function daquiA(minutos: number): Date {
  return new Date(AGORA.getTime() + minutos * 60_000);
}

describe('avaliarRotacao', () => {
  it('rotaciona quando a sessão está viva e nunca foi revogada', () => {
    const decisao = avaliarRotacao(
      { revokedAt: null, expiresAt: daquiA(60) },
      AGORA,
    );

    expect(decisao).toEqual({ tipo: 'rotacionar' });
  });

  it('não reconhece um token que não corresponde a nenhuma sessão', () => {
    expect(avaliarRotacao(null, AGORA)).toEqual({ tipo: 'desconhecida' });
  });

  it('detecta reúso quando a sessão já havia sido revogada', () => {
    // Este é o caso que importa: o token já foi rotacionado uma vez, então
    // quem o está apresentando agora tem uma cópia que não devia ter.
    const decisao = avaliarRotacao(
      { revokedAt: daquiA(-10), expiresAt: daquiA(60) },
      AGORA,
    );

    expect(decisao).toEqual({ tipo: 'reuso-detectado' });
  });

  it('recusa a sessão expirada', () => {
    const decisao = avaliarRotacao(
      { revokedAt: null, expiresAt: daquiA(-1) },
      AGORA,
    );

    expect(decisao).toEqual({ tipo: 'expirada' });
  });

  it('trata a expiração como inclusiva: expirar exatamente agora já venceu', () => {
    const decisao = avaliarRotacao(
      { revokedAt: null, expiresAt: AGORA },
      AGORA,
    );

    expect(decisao).toEqual({ tipo: 'expirada' });
  });

  it('dá precedência ao reúso sobre a expiração', () => {
    // Uma sessão revogada E expirada apresentada de novo continua sendo sinal
    // de cópia indevida. Tratá-la só como "expirada" perderia a detecção.
    const decisao = avaliarRotacao(
      { revokedAt: daquiA(-30), expiresAt: daquiA(-5) },
      AGORA,
    );

    expect(decisao).toEqual({ tipo: 'reuso-detectado' });
  });
});

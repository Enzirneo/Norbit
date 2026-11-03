/**
 * A regra do limite de frequência: janela deslizante.
 *
 * Função pura, sem relógio nem armazenamento: o instante vem de fora, e o que
 * guardar entre uma chamada e outra é problema de quem chama.
 */
import { avaliarLimite, type RegraDeLimite } from './limite-de-frequencia';

const REGRA: RegraDeLimite = { maximo: 3, janelaMs: 60_000 };

describe('avaliarLimite', () => {
  it('permite enquanto houver folga e registra o instante', () => {
    const v = avaliarLimite([], 1_000, REGRA);

    expect(v).toEqual({ permitido: true, registros: [1_000] });
  });

  it('permite até o máximo, inclusive', () => {
    const v = avaliarLimite([1_000, 2_000], 3_000, REGRA);

    expect(v).toEqual({ permitido: true, registros: [1_000, 2_000, 3_000] });
  });

  it('bloqueia a tentativa seguinte ao máximo', () => {
    const v = avaliarLimite([1_000, 2_000, 3_000], 4_000, REGRA);

    expect(v.permitido).toBe(false);
  });

  it('diz quanto falta para a tentativa mais antiga sair da janela', () => {
    const v = avaliarLimite([1_000, 2_000, 3_000], 4_000, REGRA);

    // A vaga abre quando o registro de 1_000 completar 60 s: em 61_000.
    expect(v).toEqual({ permitido: false, tentarDeNovoEmMs: 57_000 });
  });

  it('a tentativa bloqueada não é registrada: insistir não estende o bloqueio', () => {
    const antes = [1_000, 2_000, 3_000];

    avaliarLimite(antes, 4_000, REGRA);
    const depois = avaliarLimite(antes, 61_000, REGRA);

    expect(depois.permitido).toBe(true);
  });

  it('esquece o que saiu da janela', () => {
    const v = avaliarLimite([1_000, 2_000, 3_000], 61_500, REGRA);

    // O de 1_000 expirou (61_500 - 1_000 > 60_000); sobram dois, e entra o novo.
    expect(v).toEqual({
      permitido: true,
      registros: [2_000, 3_000, 61_500],
    });
  });

  it('o registro que completa exatamente a janela já saiu', () => {
    const v = avaliarLimite([1_000, 2_000, 3_000], 61_000, REGRA);

    expect(v.permitido).toBe(true);
  });

  it('com máximo 1, cada tentativa precisa esperar a janela inteira', () => {
    const regra: RegraDeLimite = { maximo: 1, janelaMs: 10_000 };

    expect(avaliarLimite([5_000], 6_000, regra)).toEqual({
      permitido: false,
      tentarDeNovoEmMs: 9_000,
    });
  });

  it.each([
    { maximo: 0, janelaMs: 1_000 },
    { maximo: -1, janelaMs: 1_000 },
    { maximo: 1, janelaMs: 0 },
    { maximo: 1.5, janelaMs: 1_000 },
  ])('recusa uma regra sem sentido: %o', (regra) => {
    expect(() => avaliarLimite([], 0, regra)).toThrow();
  });
});

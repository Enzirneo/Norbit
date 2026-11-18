import { GestoDeArrasto, LIMIAR_DO_ARRASTO_EM_PX } from './gesto-de-arrasto';

const MIN = 60_000;
const BASE = new Date('2026-06-15T00:00:00.000Z').getTime();

const INICIO = new Date('2026-06-15T09:00:00.000Z');
const FIM = new Date('2026-06-15T10:00:00.000Z');

/** Um pixel vertical vale um minuto; a coluna não muda o instante. */
function instanteEm(_x: number, y: number): Date {
  return new Date(BASE + y * MIN);
}

function gesto(): GestoDeArrasto {
  return new GestoDeArrasto(instanteEm);
}

describe('GestoDeArrasto', () => {
  it('um movimento menor que o limiar ainda é um clique', () => {
    const g = gesto();
    g.iniciar({ x: 0, y: 540, modo: 'mover', inicio: INICIO, fim: FIM });

    const provisorio = g.mover(0, 540 + LIMIAR_DO_ARRASTO_EM_PX - 1);

    expect(provisorio).toBeNull();
    expect(g.soltar()).toEqual({ moveu: false, intervalo: null });
  });

  it('passado o limiar, mover desloca o evento inteiro', () => {
    const g = gesto();
    g.iniciar({ x: 0, y: 540, modo: 'mover', inicio: INICIO, fim: FIM });

    const provisorio = g.mover(0, 540 + 60);

    expect(provisorio).toEqual({
      inicio: new Date('2026-06-15T10:00:00.000Z'),
      fim: new Date('2026-06-15T11:00:00.000Z'),
    });
  });

  it('arrastar para os lados também passa o limiar', () => {
    const g = gesto();
    g.iniciar({ x: 100, y: 540, modo: 'mover', inicio: INICIO, fim: FIM });

    // Mesmo instante, outra coluna: o deslocamento é zero, mas o gesto começou.
    g.mover(100 + LIMIAR_DO_ARRASTO_EM_PX + 1, 540);

    expect(g.soltar().moveu).toBe(true);
  });

  it('redimensionar mexe só no fim', () => {
    const g = gesto();
    g.iniciar({
      x: 0,
      y: 600,
      modo: 'redimensionar',
      inicio: INICIO,
      fim: FIM,
    });

    const provisorio = g.mover(0, 600 + 30);

    expect(provisorio).toEqual({
      inicio: INICIO,
      fim: new Date('2026-06-15T10:30:00.000Z'),
    });
  });

  it('soltar entrega o intervalo final e encerra o gesto', () => {
    const g = gesto();
    g.iniciar({ x: 0, y: 540, modo: 'mover', inicio: INICIO, fim: FIM });
    g.mover(0, 540 + 45);

    const resultado = g.soltar();

    expect(resultado.moveu).toBe(true);
    expect(resultado.intervalo?.inicio).toEqual(
      new Date('2026-06-15T09:45:00.000Z'),
    );
    expect(g.emAndamento).toBe(false);
  });

  it('arrastar e voltar ao ponto de partida não conta como mudança', () => {
    const g = gesto();
    g.iniciar({ x: 0, y: 540, modo: 'mover', inicio: INICIO, fim: FIM });
    g.mover(0, 540 + 60);
    g.mover(0, 540);

    // Houve arrasto (não pode virar clique), mas nada para gravar.
    expect(g.soltar()).toEqual({ moveu: true, intervalo: null });
  });

  it('cancelar descarta o gesto sem entregar nada', () => {
    const g = gesto();
    g.iniciar({ x: 0, y: 540, modo: 'mover', inicio: INICIO, fim: FIM });
    g.mover(0, 540 + 60);

    g.cancelar();

    expect(g.emAndamento).toBe(false);
    expect(g.soltar()).toEqual({ moveu: false, intervalo: null });
  });

  it('mover sem ter iniciado não faz nada', () => {
    expect(gesto().mover(0, 999)).toBeNull();
  });

  it('um gesto novo começa limpo depois de outro', () => {
    const g = gesto();
    g.iniciar({ x: 0, y: 540, modo: 'mover', inicio: INICIO, fim: FIM });
    g.mover(0, 540 + 60);
    g.soltar();

    g.iniciar({ x: 0, y: 300, modo: 'mover', inicio: INICIO, fim: FIM });

    expect(g.soltar()).toEqual({ moveu: false, intervalo: null });
  });
});

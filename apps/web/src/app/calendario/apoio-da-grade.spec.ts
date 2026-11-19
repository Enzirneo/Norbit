import { compararDias, fracaoDoPassado } from './apoio-da-grade';

const HOJE = { ano: 2026, mes: 11, dia: 18 };

describe('compararDias', () => {
  it('ordena por ano, depois mês, depois dia', () => {
    expect(compararDias({ ano: 2026, mes: 11, dia: 17 }, HOJE)).toBe(-1);
    expect(compararDias(HOJE, { ano: 2026, mes: 11, dia: 17 })).toBe(1);
    expect(compararDias(HOJE, { ...HOJE })).toBe(0);
  });

  it('o mês e o ano mandam mais que o dia', () => {
    expect(compararDias({ ano: 2026, mes: 10, dia: 30 }, HOJE)).toBe(-1);
    expect(compararDias({ ano: 2026, mes: 12, dia: 1 }, HOJE)).toBe(1);
    expect(compararDias({ ano: 2025, mes: 12, dia: 31 }, HOJE)).toBe(-1);
    expect(compararDias({ ano: 2027, mes: 1, dia: 1 }, HOJE)).toBe(1);
  });
});

describe('fracaoDoPassado', () => {
  it('um dia que já acabou escurece inteiro', () => {
    expect(fracaoDoPassado({ ano: 2026, mes: 11, dia: 17 }, HOJE, null)).toBe(
      100,
    );
    expect(fracaoDoPassado({ ano: 2025, mes: 12, dia: 31 }, HOJE, null)).toBe(
      100,
    );
  });

  it('um dia que ainda vem não escurece', () => {
    expect(fracaoDoPassado({ ano: 2026, mes: 11, dia: 19 }, HOJE, null)).toBe(
      0,
    );
    expect(fracaoDoPassado({ ano: 2027, mes: 1, dia: 1 }, HOJE, null)).toBe(0);
  });

  it('hoje escurece até a linha de agora, e só até ela', () => {
    expect(fracaoDoPassado(HOJE, HOJE, 64.6)).toBe(64.6);
    expect(fracaoDoPassado(HOJE, HOJE, 0)).toBe(0);
  });

  it('hoje sem posição de agora (fora da grade) não escurece nada', () => {
    expect(fracaoDoPassado(HOJE, HOJE, null)).toBe(0);
  });
});

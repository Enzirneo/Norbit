import {
  PASSO_EM_MINUTOS,
  celulaDaGrade,
  instanteNaGrade,
  moverIntervalo,
  redimensionarFim,
} from './arrastar';

const MIN = 60_000;
const HORA = 60 * MIN;

/** 9h em UTC; o fuso não importa para a aritmética de deslocamento. */
const INICIO = new Date('2026-06-15T09:00:00.000Z');
const FIM = new Date('2026-06-15T10:00:00.000Z');

describe('instanteNaGrade', () => {
  it('a fração 0 é a meia-noite e a fração 1 é a meia-noite seguinte', () => {
    const dia = { ano: 2026, mes: 6, dia: 15 };

    expect(
      instanteNaGrade({ dia, fuso: 'America/New_York', fracao: 0 }),
    ).toEqual(new Date('2026-06-15T04:00:00.000Z'));
    expect(
      instanteNaGrade({ dia, fuso: 'America/New_York', fracao: 1 }),
    ).toEqual(new Date('2026-06-16T04:00:00.000Z'));
  });

  it('a metade de um dia comum é o meio-dia', () => {
    const instante = instanteNaGrade({
      dia: { ano: 2026, mes: 6, dia: 15 },
      fuso: 'America/New_York',
      fracao: 0.5,
    });

    expect(instante).toEqual(new Date('2026-06-15T16:00:00.000Z'));
  });

  it('num dia de 23 horas a metade é 12h30, não o meio-dia', () => {
    // 8 de março de 2026: o relógio de Nova York salta de 2h para 3h. A grade
    // tem 23 horas de duração real, e a fração é sobre elas.
    const instante = instanteNaGrade({
      dia: { ano: 2026, mes: 3, dia: 8 },
      fuso: 'America/New_York',
      fracao: 0.5,
    });

    expect(instante).toEqual(new Date('2026-03-08T16:30:00.000Z'));
  });

  it('recorta o que passa das pontas, em vez de sair do dia', () => {
    const dia = { ano: 2026, mes: 6, dia: 15 };

    expect(
      instanteNaGrade({ dia, fuso: 'America/New_York', fracao: -0.3 }),
    ).toEqual(new Date('2026-06-15T04:00:00.000Z'));
    expect(
      instanteNaGrade({ dia, fuso: 'America/New_York', fracao: 1.7 }),
    ).toEqual(new Date('2026-06-16T04:00:00.000Z'));
  });
});

describe('moverIntervalo', () => {
  it('desloca início e fim juntos, mantendo a duração', () => {
    const r = moverIntervalo({
      inicio: INICIO,
      fim: FIM,
      deslocamentoMs: 2 * HORA,
    });

    expect(r.inicio).toEqual(new Date('2026-06-15T11:00:00.000Z'));
    expect(r.fim).toEqual(new Date('2026-06-15T12:00:00.000Z'));
  });

  it('arredonda o deslocamento ao passo de 15 minutos', () => {
    // 40 minutos fica mais perto de 45 que de 30.
    const mais = moverIntervalo({
      inicio: INICIO,
      fim: FIM,
      deslocamentoMs: 40 * MIN,
    });
    // 7 minutos fica mais perto de 0 que de 15.
    const menos = moverIntervalo({
      inicio: INICIO,
      fim: FIM,
      deslocamentoMs: 7 * MIN,
    });

    expect(mais.inicio).toEqual(new Date('2026-06-15T09:45:00.000Z'));
    expect(menos.inicio).toEqual(INICIO);
  });

  it('deslocamento negativo leva o evento para antes', () => {
    const r = moverIntervalo({
      inicio: INICIO,
      fim: FIM,
      deslocamentoMs: -30 * MIN,
    });

    expect(r.inicio).toEqual(new Date('2026-06-15T08:30:00.000Z'));
    expect(r.fim).toEqual(new Date('2026-06-15T09:30:00.000Z'));
  });

  it('atravessa o dia: o deslocamento pode ser de dias inteiros', () => {
    const r = moverIntervalo({
      inicio: INICIO,
      fim: FIM,
      deslocamentoMs: 24 * HORA,
    });

    expect(r.inicio).toEqual(new Date('2026-06-16T09:00:00.000Z'));
  });

  it('sem deslocamento, devolve o intervalo como está', () => {
    const r = moverIntervalo({ inicio: INICIO, fim: FIM, deslocamentoMs: 0 });

    expect(r).toEqual({ inicio: INICIO, fim: FIM });
  });

  it('não desalinha um evento que já começava fora do passo', () => {
    // 9h05 movido uma hora vai para 10h05, não para 10h00: o deslocamento é
    // que é arredondado, e não o instante resultante.
    const r = moverIntervalo({
      inicio: new Date('2026-06-15T09:05:00.000Z'),
      fim: new Date('2026-06-15T09:35:00.000Z'),
      deslocamentoMs: HORA,
    });

    expect(r.inicio).toEqual(new Date('2026-06-15T10:05:00.000Z'));
    expect(r.fim).toEqual(new Date('2026-06-15T10:35:00.000Z'));
  });

  it('um deslocamento menor que meio passo não mexe em nada', () => {
    const r = moverIntervalo({
      inicio: new Date('2026-06-15T09:05:00.000Z'),
      fim: new Date('2026-06-15T09:35:00.000Z'),
      deslocamentoMs: 3 * MIN,
    });

    expect(r.inicio).toEqual(new Date('2026-06-15T09:05:00.000Z'));
  });
});

describe('redimensionarFim', () => {
  it('estica o fim e deixa o início onde está', () => {
    const r = redimensionarFim({
      inicio: INICIO,
      fim: FIM,
      deslocamentoMs: 30 * MIN,
    });

    expect(r.inicio).toEqual(INICIO);
    expect(r.fim).toEqual(new Date('2026-06-15T10:30:00.000Z'));
  });

  it('arredonda ao passo', () => {
    const r = redimensionarFim({
      inicio: INICIO,
      fim: FIM,
      deslocamentoMs: 20 * MIN,
    });

    // 20 minutos fica mais perto de 15 que de 30.
    expect(r.fim).toEqual(new Date('2026-06-15T10:15:00.000Z'));
  });

  it('encolhe, mas não abaixo de um passo de duração', () => {
    const r = redimensionarFim({
      inicio: INICIO,
      fim: FIM,
      deslocamentoMs: -3 * HORA,
    });

    expect(r.fim).toEqual(new Date(INICIO.getTime() + PASSO_EM_MINUTOS * MIN));
  });

  it('o fim nunca vem antes do início, mesmo arrastando para cima dele', () => {
    const r = redimensionarFim({
      inicio: INICIO,
      fim: FIM,
      deslocamentoMs: -HORA,
    });

    expect(r.fim.getTime()).toBeGreaterThan(INICIO.getTime());
  });

  it('um marco de duração zero pode ser esticado', () => {
    const r = redimensionarFim({
      inicio: INICIO,
      fim: INICIO,
      deslocamentoMs: 30 * MIN,
    });

    expect(r.fim).toEqual(new Date('2026-06-15T09:30:00.000Z'));
  });

  it('um marco de duração zero não ganha duração sem arrastar', () => {
    const r = redimensionarFim({
      inicio: INICIO,
      fim: INICIO,
      deslocamentoMs: 0,
    });

    expect(r.fim).toEqual(INICIO);
  });
});

describe('celulaDaGrade', () => {
  const grade = {
    esquerda: 100,
    topo: 50,
    largura: 700,
    altura: 1000,
    colunas: 7,
  };

  it('acha a coluna pela posição horizontal', () => {
    expect(celulaDaGrade({ ...grade, x: 100, y: 50 }).coluna).toBe(0);
    expect(celulaDaGrade({ ...grade, x: 250, y: 50 }).coluna).toBe(1);
    expect(celulaDaGrade({ ...grade, x: 799, y: 50 }).coluna).toBe(6);
  });

  it('acha a fração pela posição vertical', () => {
    expect(celulaDaGrade({ ...grade, x: 100, y: 50 }).fracao).toBe(0);
    expect(celulaDaGrade({ ...grade, x: 100, y: 550 }).fracao).toBe(0.5);
    expect(celulaDaGrade({ ...grade, x: 100, y: 1050 }).fracao).toBe(1);
  });

  it('fora da grade, fica na célula mais próxima', () => {
    const esquerda = celulaDaGrade({ ...grade, x: -500, y: -500 });
    const direita = celulaDaGrade({ ...grade, x: 9000, y: 9000 });

    expect(esquerda).toEqual({ coluna: 0, fracao: 0 });
    expect(direita).toEqual({ coluna: 6, fracao: 1 });
  });

  it('uma grade sem largura ou sem colunas não quebra', () => {
    expect(celulaDaGrade({ ...grade, largura: 0, x: 300, y: 300 }).coluna).toBe(
      0,
    );
    expect(celulaDaGrade({ ...grade, colunas: 0, x: 300, y: 300 }).coluna).toBe(
      0,
    );
  });
});

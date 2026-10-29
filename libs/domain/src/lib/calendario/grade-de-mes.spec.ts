/**
 * A grade da visão de mês.
 *
 * É o cálculo que decide em que célula cada dia cai, e por isso é a origem do
 * erro mais visível de um calendário: o evento aparecendo na linha errada. Fica
 * em `libs/domain` como função pura porque é aritmética de calendário, não
 * desenho — e porque o servidor também precisa dela para saber qual intervalo
 * consultar.
 */
import { gradeDeMes, intervaloDaGrade, SEMANAS_NA_GRADE } from './grade-de-mes';

/** Formata um dia da grade como `15` ou `(30)` quando é de fora do mês. */
function celulas(semana: readonly { dia: number; noMes: boolean }[]): string {
  return semana.map((c) => (c.noMes ? `${c.dia}` : `(${c.dia})`)).join(' ');
}

describe('gradeDeMes', () => {
  it('tem sempre seis semanas', () => {
    // Altura fixa de propósito. Com quatro, cinco ou seis linhas conforme o
    // mês, a grade muda de tamanho ao navegar e tudo abaixo dela pula. O preço
    // é uma linha de dias vizinhos a mais em alguns meses, que é barato.
    for (const mes of [1, 2, 6, 12]) {
      expect(
        gradeDeMes({ ano: 2026, mes, inicioDaSemana: 0 }).semanas,
      ).toHaveLength(SEMANAS_NA_GRADE);
    }
  });

  it('tem sete dias por semana', () => {
    for (const semana of gradeDeMes({ ano: 2026, mes: 6, inicioDaSemana: 0 })
      .semanas) {
      expect(semana).toHaveLength(7);
    }
  });

  describe('junho de 2026, começando no domingo', () => {
    // 1º de junho de 2026 é uma segunda-feira.
    const grade = gradeDeMes({ ano: 2026, mes: 6, inicioDaSemana: 0 });

    it('preenche o começo com o fim de maio', () => {
      expect(celulas(grade.semanas[0] ?? [])).toBe('(31) 1 2 3 4 5 6');
    });

    it('preenche o fim com o começo de julho', () => {
      expect(celulas(grade.semanas[5] ?? [])).toBe(
        '(5) (6) (7) (8) (9) (10) (11)',
      );
    });

    it('marca como fora do mês só o que é de fora', () => {
      const doMes = grade.semanas
        .flat()
        .filter((c) => c.noMes)
        .map((c) => c.dia);

      expect(doMes).toHaveLength(30);
      expect(doMes[0]).toBe(1);
      expect(doMes[29]).toBe(30);
    });
  });

  describe('o início da semana é respeitado', () => {
    it('segunda-feira muda o alinhamento', () => {
      // O mesmo junho de 2026: começando na segunda, o dia 1º cai na primeira
      // coluna e não sobra nada de maio.
      const grade = gradeDeMes({ ano: 2026, mes: 6, inicioDaSemana: 1 });

      expect(celulas(grade.semanas[0] ?? [])).toBe('1 2 3 4 5 6 7');
    });

    it('sábado também', () => {
      const grade = gradeDeMes({ ano: 2026, mes: 6, inicioDaSemana: 6 });

      expect(celulas(grade.semanas[0] ?? [])).toBe('(30) (31) 1 2 3 4 5');
    });

    it('recusa um início de semana que não existe', () => {
      // `UserSettings.weekStartsOn` é um inteiro do banco; 7 ou -1 ali só pode
      // ser defeito, e desenhar a grade torta esconderia a causa.
      expect(() =>
        gradeDeMes({ ano: 2026, mes: 6, inicioDaSemana: 7 }),
      ).toThrow(/semana/i);
    });
  });

  describe('as bordas do calendário', () => {
    it('atravessa a virada do ano', () => {
      // Janeiro de 2027 começa numa sexta; a grade puxa dezembro de 2026.
      const grade = gradeDeMes({ ano: 2027, mes: 1, inicioDaSemana: 0 });
      const primeira = grade.semanas[0]?.[0];

      expect(primeira).toEqual({ ano: 2026, mes: 12, dia: 27, noMes: false });
    });

    it('acerta fevereiro de ano bissexto', () => {
      const grade = gradeDeMes({ ano: 2028, mes: 2, inicioDaSemana: 0 });
      const doMes = grade.semanas.flat().filter((c) => c.noMes);

      expect(doMes).toHaveLength(29);
    });

    it('acerta fevereiro de ano não bissexto', () => {
      const grade = gradeDeMes({ ano: 2026, mes: 2, inicioDaSemana: 0 });

      expect(grade.semanas.flat().filter((c) => c.noMes)).toHaveLength(28);
    });

    it('fevereiro que cabe exatamente em quatro semanas ainda tem seis', () => {
      // Fevereiro de 2026 tem 28 dias e começa num domingo: caberia em quatro
      // linhas cravadas. A grade mostra seis de qualquer forma, e as duas
      // últimas são de março.
      const grade = gradeDeMes({ ano: 2026, mes: 2, inicioDaSemana: 0 });

      expect(celulas(grade.semanas[0] ?? [])).toBe('1 2 3 4 5 6 7');
      expect(grade.semanas[4]?.every((c) => !c.noMes)).toBe(true);
    });
  });

  it('expõe o primeiro e o último dia da grade', () => {
    const grade = gradeDeMes({ ano: 2026, mes: 6, inicioDaSemana: 0 });

    expect(grade.primeiroDia).toEqual({ ano: 2026, mes: 5, dia: 31 });
    expect(grade.ultimoDia).toEqual({ ano: 2026, mes: 7, dia: 11 });
  });
});

describe('intervaloDaGrade', () => {
  const SAO_PAULO = 'America/Sao_Paulo';

  it('vai da meia-noite do primeiro dia à meia-noite depois do último', () => {
    // É o intervalo que a API recebe. Fim exclusivo, como todo intervalo do
    // produto — ver docs/09.
    const grade = gradeDeMes({ ano: 2026, mes: 6, inicioDaSemana: 0 });

    const { de, ate } = intervaloDaGrade(grade, SAO_PAULO);

    // São Paulo é UTC-3: meia-noite local de 31/05 é 03:00Z do dia 31.
    expect(de.toISOString()).toBe('2026-05-31T03:00:00.000Z');
    expect(ate.toISOString()).toBe('2026-07-12T03:00:00.000Z');
  });

  it('usa o fuso de quem está vendo, não o do servidor', () => {
    const grade = gradeDeMes({ ano: 2026, mes: 6, inicioDaSemana: 0 });

    const emNovaYork = intervaloDaGrade(grade, 'America/New_York');

    // Em junho Nova York é UTC-4.
    expect(emNovaYork.de.toISOString()).toBe('2026-05-31T04:00:00.000Z');
  });

  it('cabe no teto de 400 dias da consulta', () => {
    // A grade tem 42 dias. O teste existe para que o dia em que alguém criar
    // uma visão de ano a incompatibilidade apareça aqui, e não como 400 na
    // tela.
    const grade = gradeDeMes({ ano: 2026, mes: 6, inicioDaSemana: 0 });
    const { de, ate } = intervaloDaGrade(grade, SAO_PAULO);

    const dias = (ate.getTime() - de.getTime()) / 86_400_000;
    expect(dias).toBeLessThanOrEqual(400);
    expect(Math.round(dias)).toBe(42);
  });
});

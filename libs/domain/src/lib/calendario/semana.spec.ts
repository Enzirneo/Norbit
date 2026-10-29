/**
 * De ocorrência para célula da grade.
 *
 * A ponte entre o que a API devolve (instantes) e o que a tela desenha
 * (colunas). É literalmente onde nasce o defeito "o evento aparece no dia
 * errado": um instante cai em dias diferentes conforme o fuso, e o fim de um
 * intervalo é exclusivo.
 */
import { faixasDaSemana } from './semana';
import { gradeDeMes } from './grade-de-mes';

const SAO_PAULO = 'America/Sao_Paulo';
const NOVA_YORK = 'America/New_York';

/** A semana de 14 a 20 de junho de 2026 (domingo a sábado). */
const SEMANA =
  gradeDeMes({ ano: 2026, mes: 6, inicioDaSemana: 0 }).semanas[2] ?? [];

function resumo(
  ocorrencias: readonly { id: string; inicio: string; fim: string }[],
  fuso = SAO_PAULO,
): string {
  return faixasDaSemana(
    SEMANA,
    ocorrencias.map((o) => ({
      id: o.id,
      inicio: new Date(o.inicio),
      fim: new Date(o.fim),
    })),
    fuso,
  )
    .faixas.slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((f) => `${f.id}:${f.de}-${f.ate}@${f.trilha}`)
    .join(' ');
}

describe('a semana de referência', () => {
  it('é 14 a 20 de junho de 2026', () => {
    // Fixa o pressuposto dos testes abaixo: se a grade mudar, eles quebram aqui
    // em vez de quebrarem por um motivo confuso lá embaixo.
    expect(SEMANA.map((c) => c.dia)).toEqual([14, 15, 16, 17, 18, 19, 20]);
  });
});

describe('faixasDaSemana', () => {
  it('um evento com hora ocupa a coluna do dia local dele', () => {
    // 15/06 às 12:00 locais em São Paulo = 15:00Z. Segunda coluna.
    expect(
      resumo([
        {
          id: 'a',
          inicio: '2026-06-15T15:00:00Z',
          fim: '2026-06-15T16:00:00Z',
        },
      ]),
    ).toBe('a:1-1@0');
  });

  it('um evento de vários dias ocupa o intervalo de colunas', () => {
    // De 16/06 a 18/06 locais.
    expect(
      resumo([
        {
          id: 'viagem',
          inicio: '2026-06-16T15:00:00Z',
          fim: '2026-06-18T20:00:00Z',
        },
      ]),
    ).toBe('viagem:2-4@0');
  });

  describe('o fim exclusivo, que é onde se erra por um', () => {
    it('um dia inteiro não invade o dia seguinte', () => {
      // O dia inteiro de 15/06 em São Paulo vai de 15/06 03:00Z a 16/06 03:00Z.
      // O fim é a meia-noite que **abre** o dia 16, e não pode pintar a coluna
      // dele — é o mesmo a-menos corrigido em docs/09.
      expect(
        resumo([
          {
            id: 'feriado',
            inicio: '2026-06-15T03:00:00Z',
            fim: '2026-06-16T03:00:00Z',
          },
        ]),
      ).toBe('feriado:1-1@0');
    });

    it('três dias inteiros ocupam exatamente três colunas', () => {
      expect(
        resumo([
          {
            id: 'ponte',
            inicio: '2026-06-15T03:00:00Z',
            fim: '2026-06-18T03:00:00Z',
          },
        ]),
      ).toBe('ponte:1-3@0');
    });

    it('um evento de duração zero ainda ocupa o dia dele', () => {
      // Marco no tempo. Com a subtração do fim feita sem cuidado, ele cairia
      // no dia anterior ou desapareceria.
      expect(
        resumo([
          {
            id: 'entrega',
            inicio: '2026-06-17T15:00:00Z',
            fim: '2026-06-17T15:00:00Z',
          },
        ]),
      ).toBe('entrega:3-3@0');
    });

    it('e um marco exatamente à meia-noite local fica no dia certo', () => {
      // O caso que exige tratar duração zero à parte, e o único em que ele
      // aparece: 17/06 03:00Z é meia-noite em São Paulo. Recuar um
      // milissegundo cairia em 23:59:59.999 do dia 16 — uma coluna antes.
      //
      // O teste anterior usava meio-dia e passava com as duas implementações:
      // descoberto plantando o defeito de propósito.
      expect(
        resumo([
          {
            id: 'marco',
            inicio: '2026-06-17T03:00:00Z',
            fim: '2026-06-17T03:00:00Z',
          },
        ]),
      ).toBe('marco:3-3@0');
    });
  });

  describe('o recorte na borda da semana', () => {
    it('corta o começo de quem vem da semana anterior', () => {
      // Começa no dia 12 e termina no dia 16: aparece de 0 a 2.
      expect(
        resumo([
          {
            id: 'longo',
            inicio: '2026-06-12T15:00:00Z',
            fim: '2026-06-16T15:00:00Z',
          },
        ]),
      ).toBe('longo:0-2@0');
    });

    it('corta o fim de quem segue para a semana seguinte', () => {
      expect(
        resumo([
          {
            id: 'longo',
            inicio: '2026-06-19T15:00:00Z',
            fim: '2026-06-24T15:00:00Z',
          },
        ]),
      ).toBe('longo:5-6@0');
    });

    it('atravessa a semana inteira', () => {
      expect(
        resumo([
          {
            id: 'ferias',
            inicio: '2026-06-01T15:00:00Z',
            fim: '2026-07-01T15:00:00Z',
          },
        ]),
      ).toBe('ferias:0-6@0');
    });

    it('ignora quem não toca a semana', () => {
      expect(
        resumo([
          {
            id: 'antes',
            inicio: '2026-06-01T15:00:00Z',
            fim: '2026-06-02T15:00:00Z',
          },
          {
            id: 'depois',
            inicio: '2026-06-25T15:00:00Z',
            fim: '2026-06-26T15:00:00Z',
          },
        ]),
      ).toBe('');
    });

    it('não inclui quem termina exatamente na meia-noite que abre a semana', () => {
      // Domingo 14/06 começa às 03:00Z. Um dia inteiro do sábado 13 termina
      // exatamente ali, e pertence à semana anterior.
      expect(
        resumo([
          {
            id: 'sabado',
            inicio: '2026-06-13T03:00:00Z',
            fim: '2026-06-14T03:00:00Z',
          },
        ]),
      ).toBe('');
    });
  });

  describe('o fuso de quem está vendo', () => {
    it('longe da meia-noite os dois fusos concordam', () => {
      // 16/06 às 15:00Z é dia 16 nos dois: 12:00 em São Paulo, 11:00 em Nova
      // York. O fuso não muda nada aqui — é o contraste para o teste seguinte.
      const ocorrencia = [
        {
          id: 'x',
          inicio: '2026-06-16T15:00:00Z',
          fim: '2026-06-16T16:00:00Z',
        },
      ];

      expect(resumo(ocorrencia, SAO_PAULO)).toBe('x:2-2@0');
      expect(resumo(ocorrencia, NOVA_YORK)).toBe('x:2-2@0');
    });

    it('perto da meia-noite eles caem em colunas diferentes', () => {
      // 15/06 às 03:30Z é 00:30 do dia 15 em São Paulo (UTC-3) e 23:30 do dia
      // **14** em Nova York (UTC-4). Uma coluna de diferença, e é por isso que
      // a grade é montada no fuso de quem está vendo.
      const ocorrencia = [
        {
          id: 'y',
          inicio: '2026-06-15T03:30:00Z',
          fim: '2026-06-15T03:30:00Z',
        },
      ];

      expect(resumo(ocorrencia, SAO_PAULO)).toBe('y:1-1@0');
      expect(resumo(ocorrencia, NOVA_YORK)).toBe('y:0-0@0');
    });
  });

  it('empilha as faixas que compartilham dia', () => {
    expect(
      resumo([
        {
          id: 'a',
          inicio: '2026-06-15T15:00:00Z',
          fim: '2026-06-17T15:00:00Z',
        },
        {
          id: 'b',
          inicio: '2026-06-16T15:00:00Z',
          fim: '2026-06-18T15:00:00Z',
        },
      ]),
    ).toBe('a:1-3@0 b:2-4@1');
  });

  it('recusa ocorrência com fim antes do início', () => {
    expect(() =>
      faixasDaSemana(
        SEMANA,
        [
          {
            id: 'a',
            inicio: new Date('2026-06-17T15:00:00Z'),
            fim: new Date('2026-06-15T15:00:00Z'),
          },
        ],
        SAO_PAULO,
      ),
    ).toThrow(/ordem/i);
  });
});

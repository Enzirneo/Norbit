/**
 * Eventos simultâneos, lado a lado.
 *
 * Duas reuniões das 9h às 10h não podem ser desenhadas uma sobre a outra. Esta
 * função decide em que coluna cada uma entra e em quantas colunas a vizinhança
 * se divide.
 *
 * Opera sobre a **geometria** — topo e altura, já calculados por
 * `grade-de-horas` —, e não sobre instantes: é a geometria que não pode se
 * sobrepor na tela, e é nela que a altura mínima de um marco de duração zero já
 * está aplicada.
 */
import { distribuirColunas } from './colunas';

/** Resume como `id:coluna/colunas`, em ordem de id. */
function resumo(
  itens: readonly { id: string; topo: number; altura: number }[],
): string {
  return distribuirColunas(itens)
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((c) => `${c.id}:${c.coluna}/${c.colunas}`)
    .join(' ');
}

describe('distribuirColunas', () => {
  it('não devolve nada para lista vazia', () => {
    expect(distribuirColunas([])).toEqual([]);
  });

  it('um evento sozinho ocupa a largura toda', () => {
    expect(resumo([{ id: 'a', topo: 0.3, altura: 0.1 }])).toBe('a:0/1');
  });

  it('eventos que não se cruzam ocupam a largura toda cada um', () => {
    expect(
      resumo([
        { id: 'a', topo: 0.1, altura: 0.1 },
        { id: 'b', topo: 0.5, altura: 0.1 },
      ]),
    ).toBe('a:0/1 b:0/1');
  });

  it('dois simultâneos dividem em dois', () => {
    expect(
      resumo([
        { id: 'a', topo: 0.3, altura: 0.2 },
        { id: 'b', topo: 0.35, altura: 0.2 },
      ]),
    ).toBe('a:0/2 b:1/2');
  });

  it('três simultâneos dividem em três', () => {
    expect(
      resumo([
        { id: 'a', topo: 0.3, altura: 0.2 },
        { id: 'b', topo: 0.32, altura: 0.2 },
        { id: 'c', topo: 0.34, altura: 0.2 },
      ]),
    ).toBe('a:0/3 b:1/3 c:2/3');
  });

  describe('a borda, que é onde se erra', () => {
    it('terminar exatamente onde o outro começa NÃO é sobreposição', () => {
      // Uma reunião das 9h às 10h e outra das 10h às 11h são sequenciais. Em
      // duas colunas, cada uma ficaria com metade da largura sem motivo.
      expect(
        resumo([
          { id: 'a', topo: 0.25, altura: 0.25 },
          { id: 'b', topo: 0.5, altura: 0.25 },
        ]),
      ).toBe('a:0/1 b:0/1');
    });

    it('o sequencial não é arrastado para a vizinhança seguinte', () => {
      // Com dois eventos sequenciais a resposta é a mesma de qualquer forma —
      // a vizinhança tem uma coluna nos dois casos. A diferença aparece com um
      // terceiro: se `a` entrasse no grupo de `b` e `c`, ele apareceria com
      // metade da largura sem ter vizinho nenhum.
      //
      // Descoberto plantando o defeito: o teste de duas faixas passava com as
      // duas implementações.
      expect(
        resumo([
          { id: 'a', topo: 0.25, altura: 0.25 }, // 9h–10h
          { id: 'b', topo: 0.5, altura: 0.25 }, // 10h–11h
          { id: 'c', topo: 0.52, altura: 0.25 }, // 10h30–11h30
        ]),
      ).toBe('a:0/1 b:0/2 c:1/2');
    });

    it('um instante de sobreposição já conta', () => {
      expect(
        resumo([
          { id: 'a', topo: 0.25, altura: 0.2501 },
          { id: 'b', topo: 0.5, altura: 0.25 },
        ]),
      ).toBe('a:0/2 b:1/2');
    });
  });

  describe('a vizinhança é transitiva, e a coluna é reaproveitada', () => {
    it('A cruza B, B cruza C, A não cruza C: duas colunas', () => {
      // Os três formam uma vizinhança só, porque B liga A a C. Mas A e C podem
      // dividir a mesma coluna, e aí a vizinhança precisa de duas — não de
      // três. Dar três deixaria um terço da largura vazio o tempo todo.
      expect(
        resumo([
          { id: 'a', topo: 0.1, altura: 0.15 },
          { id: 'b', topo: 0.2, altura: 0.15 },
          { id: 'c', topo: 0.3, altura: 0.15 },
        ]),
      ).toBe('a:0/2 b:1/2 c:0/2');
    });
  });

  describe('a contagem é por vizinhança, não do dia', () => {
    it('um evento isolado não é espremido por uma aglomeração em outra hora', () => {
      // O defeito que este teste impede: contar as colunas do **dia** faria o
      // evento solitário da tarde aparecer com um terço da largura porque a
      // manhã estava cheia.
      expect(
        resumo([
          { id: 'manha1', topo: 0.3, altura: 0.1 },
          { id: 'manha2', topo: 0.32, altura: 0.1 },
          { id: 'manha3', topo: 0.34, altura: 0.1 },
          { id: 'tarde', topo: 0.7, altura: 0.1 },
        ]),
      ).toBe('manha1:0/3 manha2:1/3 manha3:2/3 tarde:0/1');
    });
  });

  describe('o resultado é estável', () => {
    it('a mesma entrada em outra ordem dá o mesmo resultado', () => {
      // Sem isto os eventos trocariam de coluna a cada renderização, porque a
      // ordem da resposta da API não é garantida.
      const itens = [
        { id: 'a', topo: 0.3, altura: 0.2 },
        { id: 'b', topo: 0.35, altura: 0.2 },
        { id: 'c', topo: 0.4, altura: 0.2 },
      ];

      expect(resumo(itens)).toBe(resumo([...itens].reverse()));
    });

    it('eventos no mesmo horário desempatam pelo id', () => {
      expect(
        resumo([
          { id: 'z', topo: 0.3, altura: 0.2 },
          { id: 'a', topo: 0.3, altura: 0.2 },
        ]),
      ).toBe('a:0/2 z:1/2');
    });
  });

  describe('entradas que só podem vir de um defeito', () => {
    it('recusa id repetido', () => {
      // Como em `faixas.ts`: `OcorrenciaVisivel.id` repete numa série, e a
      // identidade da instância é o par com `inicioOriginal`.
      expect(() =>
        distribuirColunas([
          { id: 'serie', topo: 0.1, altura: 0.1 },
          { id: 'serie', topo: 0.5, altura: 0.1 },
        ]),
      ).toThrow(/repetido/i);
    });

    it('recusa altura não positiva', () => {
      // Altura zero é invisível, e `grade-de-horas` já aplica um mínimo. Chegar
      // zero aqui significa que alguém montou a entrada por fora.
      expect(() =>
        distribuirColunas([{ id: 'a', topo: 0.1, altura: 0 }]),
      ).toThrow(/altura/i);
    });

    it('recusa posição não finita', () => {
      expect(() =>
        distribuirColunas([{ id: 'a', topo: Number.NaN, altura: 0.1 }]),
      ).toThrow(/finit/i);
    });
  });
});

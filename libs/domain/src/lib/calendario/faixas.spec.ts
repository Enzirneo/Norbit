/**
 * Empilhamento das faixas de uma semana da grade.
 *
 * Um evento de vários dias é desenhado como **uma** barra atravessando as
 * células, não como um chip repetido em cada dia — repetir faria "Viagem"
 * aparecer sete vezes. Duas barras que compartilham um dia precisam de alturas
 * diferentes, e é essa atribuição que esta função resolve.
 *
 * O erro que ela existe para impedir é de um: barras que se sobrepõem na tela,
 * ou um buraco entre duas que podiam dividir a mesma linha.
 */
import { empilharFaixas } from './faixas';

/** Resume o resultado como `id:trilha`, em ordem de id, para ler de uma vez. */
function resumo(
  itens: readonly { id: string; de: number; ate: number }[],
): string {
  return empilharFaixas(itens)
    .faixas.slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((f) => `${f.id}:${f.trilha}`)
    .join(' ');
}

describe('empilharFaixas', () => {
  it('não devolve nada para lista vazia', () => {
    expect(empilharFaixas([])).toEqual({ faixas: [], trilhas: 0 });
  });

  it('item sozinho fica na primeira trilha', () => {
    expect(empilharFaixas([{ id: 'a', de: 2, ate: 4 }])).toEqual({
      faixas: [{ id: 'a', de: 2, ate: 4, trilha: 0 }],
      trilhas: 1,
    });
  });

  it('itens que não se cruzam dividem a mesma trilha', () => {
    // É o que mantém a célula baixa: três eventos curtos em dias diferentes
    // ocupam uma linha, não três.
    expect(
      resumo([
        { id: 'a', de: 0, ate: 1 },
        { id: 'b', de: 2, ate: 3 },
        { id: 'c', de: 5, ate: 6 },
      ]),
    ).toBe('a:0 b:0 c:0');
  });

  it('itens que se cruzam sobem de trilha', () => {
    expect(
      resumo([
        { id: 'a', de: 0, ate: 3 },
        { id: 'b', de: 2, ate: 5 },
      ]),
    ).toBe('a:0 b:1');
  });

  describe('as bordas, que é onde se erra por um', () => {
    it('terminar numa coluna e começar na seguinte NÃO é sobreposição', () => {
      // `ate` é inclusivo. Tratar 1 e 2 como conflito deixaria um buraco de
      // uma linha em toda semana com dois eventos seguidos.
      expect(
        resumo([
          { id: 'a', de: 0, ate: 1 },
          { id: 'b', de: 2, ate: 3 },
        ]),
      ).toBe('a:0 b:0');
    });

    it('terminar e começar na MESMA coluna é sobreposição', () => {
      // As duas barras tocariam a mesma célula. Na mesma trilha, uma cobriria a
      // outra.
      expect(
        resumo([
          { id: 'a', de: 0, ate: 2 },
          { id: 'b', de: 2, ate: 4 },
        ]),
      ).toBe('a:0 b:1');
    });

    it('item de um dia só conflita com quem cobre aquele dia', () => {
      expect(
        resumo([
          { id: 'longo', de: 0, ate: 6 },
          { id: 'meio', de: 3, ate: 3 },
        ]),
      ).toBe('longo:0 meio:1');
    });
  });

  describe('a ordem das trilhas', () => {
    it('o mais longo fica por cima, independente de quem chegou primeiro', () => {
      // A barra longa é a que se lê de ponta a ponta; na trilha de cima ela
      // fica inteira e visível. Se ela fosse para baixo, as curtas a
      // quebrariam visualmente em pedaços.
      expect(
        resumo([
          { id: 'curto', de: 0, ate: 0 },
          { id: 'longo', de: 0, ate: 6 },
        ]),
      ).toBe('curto:1 longo:0');
    });

    it('reusa a trilha liberada por quem já terminou', () => {
      // `a` ocupa 0..1 na trilha 0. `c`, que começa em 2, cabe lá — mesmo
      // havendo `b` na trilha 1 atravessando tudo.
      expect(
        resumo([
          { id: 'a', de: 0, ate: 1 },
          { id: 'b', de: 0, ate: 6 },
          { id: 'c', de: 3, ate: 4 },
        ]),
      ).toBe('a:1 b:0 c:1');
    });
  });

  describe('o resultado é estável', () => {
    it('a mesma entrada em outra ordem dá o mesmo resultado', () => {
      // Sem isto as barras pulariam de altura a cada renderização, porque a
      // ordem da resposta da API não é garantida.
      const itens = [
        { id: 'a', de: 0, ate: 2 },
        { id: 'b', de: 1, ate: 3 },
        { id: 'c', de: 2, ate: 4 },
      ];

      expect(resumo(itens)).toBe(resumo([...itens].reverse()));
    });

    it('itens idênticos em posição e tamanho desempatam pelo id', () => {
      expect(
        resumo([
          { id: 'z', de: 0, ate: 2 },
          { id: 'a', de: 0, ate: 2 },
        ]),
      ).toBe('a:0 z:1');
    });
  });

  it('conta as trilhas usadas, para a célula saber a altura', () => {
    const { trilhas } = empilharFaixas([
      { id: 'a', de: 0, ate: 6 },
      { id: 'b', de: 0, ate: 6 },
      { id: 'c', de: 0, ate: 6 },
    ]);

    expect(trilhas).toBe(3);
  });

  describe('entradas que só podem vir de um defeito', () => {
    it('recusa fim antes do começo', () => {
      expect(() => empilharFaixas([{ id: 'a', de: 4, ate: 2 }])).toThrow(
        /ordem/i,
      );
    });

    it('recusa id repetido', () => {
      // `OcorrenciaVisivel.id` é o id da linha, e repete entre as ocorrências
      // de uma série. Sem esta recusa, duas terças da mesma série virariam uma
      // só — e o sintoma ("o evento semanal aparece uma vez por semana") não
      // apontaria para cá.
      expect(() =>
        empilharFaixas([
          { id: 'serie', de: 1, ate: 1 },
          { id: 'serie', de: 3, ate: 3 },
        ]),
      ).toThrow(/repetido/i);
    });

    it('recusa coluna não inteira ou negativa', () => {
      expect(() => empilharFaixas([{ id: 'a', de: -1, ate: 2 }])).toThrow(
        /coluna/i,
      );
      expect(() => empilharFaixas([{ id: 'a', de: 0, ate: 1.5 }])).toThrow(
        /coluna/i,
      );
    });
  });
});

/**
 * Ordenação manual de tarefas.
 *
 * `Task.position` é `Float` justamente para que arrastar um item para o meio da
 * lista seja **uma** escrita, e não uma reindexação de tudo. O comentário no
 * `schema.prisma` afirma isso, e é verdade — até certo ponto. Estes testes
 * existem para achar o ponto exato, porque o modo de falha é silencioso: dois
 * itens com a mesma posição, e a lista passa a mudar de ordem sozinha a cada
 * recarga.
 */
import { PASSO, posicaoEntre, renumerar, type Reordenacao } from './ordenacao';

/** Extrai a posição, falhando o teste se a resposta foi "renumerar". */
function valorDe(resultado: Reordenacao): number {
  if (resultado.tipo !== 'posicao') {
    throw new Error(`Esperava uma posição, veio ${resultado.tipo}.`);
  }
  return resultado.valor;
}

describe('posicaoEntre', () => {
  it('a primeira tarefa da lista não fica em zero', () => {
    // Deixar espaço **antes** do primeiro item é o que permite arrastar algo
    // para o topo depois sem renumerar nada.
    expect(valorDe(posicaoEntre(null, null))).toBe(PASSO);
  });

  it('no fim da lista, avança um passo', () => {
    expect(valorDe(posicaoEntre(PASSO, null))).toBe(PASSO * 2);
  });

  it('no começo da lista, recua um passo', () => {
    expect(valorDe(posicaoEntre(null, PASSO))).toBe(0);
  });

  it('entre dois itens, fica no meio', () => {
    expect(valorDe(posicaoEntre(0, 1024))).toBe(512);
  });

  it('recua para negativo sem reclamar', () => {
    // Posição negativa é legítima: a ordem é relativa, e `0` não é um piso.
    // Tratar `0` como piso faria a terceira inserção no topo colidir.
    const primeira = valorDe(posicaoEntre(null, 0));
    const segunda = valorDe(posicaoEntre(null, primeira));

    expect(primeira).toBeLessThan(0);
    expect(segunda).toBeLessThan(primeira);
  });

  describe('quando não há mais espaço entre os dois', () => {
    it('pede renumeração em vez de devolver uma posição duplicada', () => {
      // Dois doubles adjacentes: não existe valor representável entre eles.
      // Sem esta verificação, a média cairia **em cima** de um dos dois, e a
      // lista passaria a ter dois itens na mesma posição.
      const resultado = posicaoEntre(1, 1 + Number.EPSILON);

      expect(resultado.tipo).toBe('renumerar');
    });

    it('e isso realmente acontece com inserção repetida no mesmo ponto', () => {
      // A prova do limite da afirmação do schema. Arrastar sempre para a mesma
      // fenda divide o intervalo pela metade; o double acaba.
      let anterior = 0;
      const proxima = PASSO;
      let insercoes = 0;

      for (;;) {
        const resultado = posicaoEntre(anterior, proxima);
        if (resultado.tipo === 'renumerar') {
          break;
        }

        // A invariante que importa: enquanto devolve posição, ela é
        // estritamente entre as duas. Nunca igual a nenhuma delas.
        expect(resultado.valor).toBeGreaterThan(anterior);
        expect(resultado.valor).toBeLessThan(proxima);

        anterior = resultado.valor;
        insercoes++;
        expect(insercoes).toBeLessThan(100);
      }

      // Entre 50 e 70 inserções no mesmo ponto, com `PASSO` de 1024. Na
      // prática ninguém chega perto; o que importa é que o fim do espaço é
      // **detectado** em vez de corromper a lista.
      expect(insercoes).toBeGreaterThan(40);
    });
  });

  describe('entradas que só podem vir de um defeito', () => {
    it('recusa ordem invertida', () => {
      // Quem chama errou os vizinhos. Chutar uma posição aqui esconderia o bug
      // e produziria uma lista fora de ordem.
      expect(() => posicaoEntre(1024, 0)).toThrow(/ordem/i);
    });

    it('recusa posições iguais', () => {
      expect(() => posicaoEntre(512, 512)).toThrow(/ordem/i);
    });

    it('recusa valor não finito vindo do banco', () => {
      expect(() => posicaoEntre(Number.NaN, 1024)).toThrow(/finit/i);
      expect(() => posicaoEntre(0, Number.POSITIVE_INFINITY)).toThrow(/finit/i);
    });
  });
});

describe('renumerar', () => {
  it('espaça as posições pelo passo, preservando a ordem recebida', () => {
    expect(renumerar(3)).toEqual([PASSO, PASSO * 2, PASSO * 3]);
  });

  it('devolve vazio para lista vazia', () => {
    expect(renumerar(0)).toEqual([]);
  });

  it('o resultado volta a ter espaço entre todos os pares', () => {
    // A renumeração só vale se ela de fato resolve: depois dela, inserir entre
    // quaisquer dois vizinhos tem de voltar a funcionar.
    const posicoes = renumerar(5);

    for (let i = 0; i < posicoes.length - 1; i++) {
      const resultado = posicaoEntre(
        posicoes[i] ?? null,
        posicoes[i + 1] ?? null,
      );
      expect(resultado.tipo).toBe('posicao');
    }
  });
});

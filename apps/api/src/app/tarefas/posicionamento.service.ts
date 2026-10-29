/**
 * Onde a ordenação fracionária encontra o banco.
 *
 * A aritmética é pura e vive em `libs/domain/src/lib/tarefas/ordenacao.ts`. Aqui
 * acontece o que depende de linhas: descobrir a posição dos vizinhos, e executar
 * a renumeração quando o espaço entre eles acaba.
 *
 * "Irmãs" significa a mesma agenda **e** a mesma tarefa-mãe. Uma subtarefa é
 * ordenada dentro da mãe dela, não dentro da lista toda — do contrário arrastar
 * uma subtarefa mexeria na ordem das tarefas de cima.
 */
import { BadRequestException, Injectable } from '@nestjs/common';
import { posicaoEntre, renumerar } from '@norbit/domain';
import { PrismaService, type Task } from '@norbit/db';

type Vizinhos = {
  readonly anteriorId: string | null;
  readonly proximaId: string | null;
};

@Injectable()
export class PosicionamentoService {
  constructor(private readonly prisma: PrismaService) {}

  /** A posição para uma tarefa nova: no fim da lista das irmãs. */
  async noFim(
    calendarId: string,
    parentTaskId: string | null,
  ): Promise<number> {
    const ultima = await this.prisma.task.findFirst({
      where: { calendarId, parentTaskId, deletedAt: null },
      orderBy: { position: 'desc' },
      select: { position: true },
    });

    const decisao = posicaoEntre(ultima?.position ?? null, null);

    // No fim da lista não existe "sem espaço": a posição só cresce. Mas o tipo
    // obriga a tratar, e tratar é melhor que um `as number` — se um dia o fim
    // da lista passar a ter vizinho à direita, isto já está correto.
    return decisao.tipo === 'posicao'
      ? decisao.valor
      : await this.renumerarEDevolverOFim(calendarId, parentTaskId);
  }

  /**
   * Move a tarefa para entre os dois vizinhos.
   *
   * Devolve a posição nova. Quando o espaço acabou, renumera as irmãs — numa
   * transação, porque uma renumeração pela metade deixa a lista em ordem
   * arbitrária, que é pior que a lista apertada de antes.
   */
  async mover(tarefa: Task, vizinhos: Vizinhos): Promise<number> {
    const irmas = await this.irmas(tarefa);
    const anterior = this.posicaoDe(irmas, vizinhos.anteriorId, tarefa);
    const proxima = this.posicaoDe(irmas, vizinhos.proximaId, tarefa);

    if (anterior !== null && proxima !== null && anterior >= proxima) {
      throw new BadRequestException(
        'Os vizinhos informados não são adjacentes nesta ordem.',
      );
    }

    const decisao = posicaoEntre(anterior, proxima);
    if (decisao.tipo === 'posicao') {
      return decisao.valor;
    }

    return this.renumerarInserindo(tarefa, irmas, vizinhos);
  }

  // ─── privados ──────────────────────────────────────────────────────────────

  /**
   * As irmãs, em ordem, **sem** a própria tarefa.
   *
   * Tirá-la da lista é o que faz "mover para o lugar onde já estou" não virar
   * `anterior === proxima`: os vizinhos que o cliente manda são os de depois do
   * movimento, e a tarefa não é vizinha de si mesma.
   */
  private async irmas(tarefa: Task): Promise<Task[]> {
    return this.prisma.task.findMany({
      where: {
        calendarId: tarefa.calendarId,
        parentTaskId: tarefa.parentTaskId,
        deletedAt: null,
        id: { not: tarefa.id },
      },
      orderBy: { position: 'asc' },
    });
  }

  /**
   * A posição do vizinho pedido.
   *
   * Vizinho que não é irmã é recusado: aceitar faria a tarefa receber uma
   * posição calculada contra outra lista, e ela apareceria em lugar nenhum
   * previsível.
   */
  private posicaoDe(
    irmas: readonly Task[],
    id: string | null,
    tarefa: Task,
  ): number | null {
    if (id === null) {
      return null;
    }

    if (id === tarefa.id) {
      throw new BadRequestException(
        'Uma tarefa não pode ser vizinha de si mesma.',
      );
    }

    const irma = irmas.find((candidata) => candidata.id === id);
    if (!irma) {
      throw new BadRequestException(
        'Os vizinhos precisam estar na mesma lista que a tarefa movida.',
      );
    }

    return irma.position;
  }

  private async renumerarEDevolverOFim(
    calendarId: string,
    parentTaskId: string | null,
  ): Promise<number> {
    const irmas = await this.prisma.task.findMany({
      where: { calendarId, parentTaskId, deletedAt: null },
      orderBy: { position: 'asc' },
      select: { id: true },
    });

    const posicoes = renumerar(irmas.length + 1);
    await this.aplicar(
      irmas.map(({ id }) => id),
      posicoes,
    );

    return posicoes[posicoes.length - 1] as number;
  }

  /**
   * Renumera as irmãs com a tarefa já no lugar novo.
   *
   * A ordem final é montada aqui, e não depois: renumerar primeiro e mover
   * depois seriam duas escritas, e entre elas a lista existiria com a tarefa no
   * lugar antigo.
   */
  private async renumerarInserindo(
    tarefa: Task,
    irmas: readonly Task[],
    vizinhos: Vizinhos,
  ): Promise<number> {
    const ordem = irmas.map(({ id }) => id);
    const destino =
      vizinhos.anteriorId === null ? 0 : ordem.indexOf(vizinhos.anteriorId) + 1;

    ordem.splice(destino, 0, tarefa.id);

    const posicoes = renumerar(ordem.length);
    await this.aplicar(ordem, posicoes);

    return posicoes[destino] as number;
  }

  /** Uma transação: lista renumerada pela metade é pior que lista apertada. */
  private async aplicar(
    ids: readonly string[],
    posicoes: readonly number[],
  ): Promise<void> {
    await this.prisma.$transaction(
      ids.map((id, indice) =>
        this.prisma.task.update({
          where: { id },
          data: { position: posicoes[indice] },
        }),
      ),
    );
  }
}

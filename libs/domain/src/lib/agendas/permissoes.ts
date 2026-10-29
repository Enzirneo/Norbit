/**
 * Quem pode o quê numa agenda compartilhada.
 *
 * Toda a autorização do produto é esta tabela, e ela é uma função pura de
 * propósito: autorização espalhada por controllers diverge, e divergência de
 * autorização aparece como vazamento de dado. O serviço resolve **qual** é o
 * papel (isso depende do banco) e pergunta aqui o veredito.
 *
 * Os quatro papéis espelham o enum `CalendarRole` do schema. A duplicação é
 * deliberada: `libs/domain` não conhece o Prisma, e é essa ignorância que a
 * mantém testável sem banco. A compatibilidade entre os dois é garantida em
 * tempo de compilação pelo serviço que faz a ponte.
 */

export type Papel = 'OWNER' | 'EDITOR' | 'CONTRIBUTOR' | 'VIEWER';

/** Ações cujo veredito depende apenas do papel. */
export type AcaoDeAgenda =
  | 'ver'
  | 'criar-evento'
  | 'criar-tarefa'
  | 'editar-agenda'
  | 'excluir-agenda'
  | 'gerenciar-membros';

/**
 * Ações cujo veredito também depende de quem criou o item.
 *
 * Evento e tarefa aparecem separados, e não sob um "conteúdo" genérico, por dois
 * motivos: a mensagem de recusa diz qual das duas coisas a pessoa tentou mexer, e
 * o dia em que as duas divergirem (uma agenda só de leitura para tarefas, por
 * exemplo) a matriz já tem onde expressar isso. O **alcance** é um só, porque a
 * regra hoje é a mesma.
 */
export type AcaoDeItem =
  'editar-evento' | 'excluir-evento' | 'editar-tarefa' | 'excluir-tarefa';

/** Até onde o papel alcança nos itens da agenda — eventos e tarefas. */
type Alcance = 'qualquer' | 'proprios' | 'nenhum';

type Capacidades = {
  readonly naAgenda: readonly AcaoDeAgenda[];
  readonly nosItens: Alcance;
};

/**
 * A matriz, escrita como dado e não como cadeia de `if`.
 *
 * `EDITOR` mexe em qualquer evento mas não na agenda: renomear a agenda da
 * família, convidar gente e apagá-la continuam sendo do dono. `CONTRIBUTOR` é
 * o papel que faz uma agenda de time funcionar — todo mundo lança os próprios
 * compromissos sem poder apagar os dos outros.
 */
const MATRIZ: Record<Papel, Capacidades> = {
  OWNER: {
    naAgenda: [
      'ver',
      'criar-evento',
      'criar-tarefa',
      'editar-agenda',
      'excluir-agenda',
      'gerenciar-membros',
    ],
    nosItens: 'qualquer',
  },
  EDITOR: {
    naAgenda: ['ver', 'criar-evento', 'criar-tarefa'],
    nosItens: 'qualquer',
  },
  CONTRIBUTOR: {
    naAgenda: ['ver', 'criar-evento', 'criar-tarefa'],
    nosItens: 'proprios',
  },
  VIEWER: {
    naAgenda: ['ver'],
    nosItens: 'nenhum',
  },
};

/** Os papéis existentes, derivados da matriz para não poderem discordar dela. */
export const PAPEIS: readonly Papel[] = Object.freeze(
  Object.keys(MATRIZ) as Papel[],
);

export function podeNaAgenda(papel: Papel, acao: AcaoDeAgenda): boolean {
  return capacidadesDe(papel)?.naAgenda.includes(acao) ?? false;
}

export function podeNoItem(entrada: {
  readonly papel: Papel;
  readonly acao: AcaoDeItem;
  readonly ehAutor: boolean;
}): boolean {
  const alcance = capacidadesDe(entrada.papel)?.nosItens ?? 'nenhum';

  // A `acao` não participa da decisão **hoje** — editar e excluir têm a mesma
  // regra nas duas entidades. Ela está na assinatura porque é o que torna a
  // divergência futura uma alteração nesta função, e não uma nova função solta
  // em algum controller.
  switch (alcance) {
    case 'qualquer':
      return true;
    // Autoria **amplia** o que o papel concede; nunca substitui. É por isso que
    // o VIEWER não edita nem o evento que ele mesmo criou antes de ser
    // rebaixado: do contrário o rebaixamento não significaria nada.
    case 'proprios':
      return entrada.ehAutor;
    case 'nenhum':
      return false;
  }
}

/**
 * Busca na matriz sem confiar no tipo.
 *
 * O `Record` mente aqui de propósito: ele existe para que acrescentar um papel
 * ao enum **force** uma linha nova na matriz, e não para prometer que todo valor
 * que chega em runtime é um dos quatro. O papel vem do banco, e um valor fora do
 * enum (migration mal aplicada, linha editada à mão) não pode virar permissão
 * por omissão.
 *
 * A indexação devolve `undefined` nesse caso, e é o `?? false` / `?? 'nenhum'`
 * de quem chama que transforma isso em recusa — verificado por mutação: trocar
 * esses padrões por `true` / `'qualquer'` quebra os testes.
 *
 * Uma primeira versão guardava a leitura com `Object.hasOwn`. A mutação mostrou
 * que **nenhum teste** notava a remoção do guard, e o motivo é que ele não
 * protegia nada: a indexação já devolvia `undefined` sozinha. Comentário
 * afirmando ser defesa, sobre código que não defendia.
 */
function capacidadesDe(papel: Papel): Capacidades | undefined {
  return MATRIZ[papel];
}

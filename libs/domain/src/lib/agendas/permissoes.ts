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
  | 'editar-agenda'
  | 'excluir-agenda'
  | 'gerenciar-membros';

/** Ações cujo veredito também depende de quem criou o evento. */
export type AcaoDeEvento = 'editar-evento' | 'excluir-evento';

/** Até onde o papel alcança nos eventos da agenda. */
type Alcance = 'qualquer' | 'proprios' | 'nenhum';

type Capacidades = {
  readonly naAgenda: readonly AcaoDeAgenda[];
  readonly nosEventos: Alcance;
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
      'editar-agenda',
      'excluir-agenda',
      'gerenciar-membros',
    ],
    nosEventos: 'qualquer',
  },
  EDITOR: {
    naAgenda: ['ver', 'criar-evento'],
    nosEventos: 'qualquer',
  },
  CONTRIBUTOR: {
    naAgenda: ['ver', 'criar-evento'],
    nosEventos: 'proprios',
  },
  VIEWER: {
    naAgenda: ['ver'],
    nosEventos: 'nenhum',
  },
};

/** Os papéis existentes, derivados da matriz para não poderem discordar dela. */
export const PAPEIS: readonly Papel[] = Object.freeze(
  Object.keys(MATRIZ) as Papel[],
);

export function podeNaAgenda(papel: Papel, acao: AcaoDeAgenda): boolean {
  return capacidadesDe(papel)?.naAgenda.includes(acao) ?? false;
}

export function podeNoEvento(entrada: {
  readonly papel: Papel;
  readonly acao: AcaoDeEvento;
  readonly ehAutor: boolean;
}): boolean {
  const alcance = capacidadesDe(entrada.papel)?.nosEventos ?? 'nenhum';

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

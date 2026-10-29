/**
 * O seletor de repetição do formulário.
 *
 * Ele oferece quatro opções; a RFC 5545 tem muito mais. A decisão que define
 * este módulo não é como montar a regra — é **o que fazer com uma regra que o
 * seletor não sabe expressar**.
 *
 * A resposta é: preservar, intacta, e mostrar como "personalizada". Um seletor
 * que exibisse "toda semana" para `FREQ=WEEKLY;UNTIL=20261231T000000Z` e
 * salvasse `FREQ=WEEKLY` teria apagado o fim da série sem avisar — e quem
 * salvou só queria corrigir o título.
 *
 * É o mesmo princípio do parser em `recorrencia/rrule.ts`: **recusar, nunca
 * ignorar**. Aqui a forma de recusar é não mexer.
 */
import { lerRrule, type DiaDaSemana, type Regra } from '../recorrencia/rrule';

export type Repeticao =
  | { readonly tipo: 'nao-repete' }
  | { readonly tipo: 'diaria' }
  | { readonly tipo: 'semanal'; readonly dias: readonly DiaDaSemana[] }
  /** Mesmo dia do mês — a regra sozinha já segue o dia do início. */
  | { readonly tipo: 'mensal' }
  | { readonly tipo: 'anual' }
  /** O que o seletor não expressa. A interface mostra e não deixa editar. */
  | { readonly tipo: 'personalizada'; readonly regra: string };

/**
 * A ordem canônica dos dias, começando na segunda.
 *
 * Existe para a ida e volta fechar: sem ordem fixa, salvar duas vezes sem mexer
 * em nada produziria dois textos diferentes no banco.
 */
const ORDEM: readonly DiaDaSemana[] = [
  'MO',
  'TU',
  'WE',
  'TH',
  'FR',
  'SA',
  'SU',
];

export function montarRrule(escolha: Repeticao): string | null {
  switch (escolha.tipo) {
    case 'nao-repete':
      return null;
    case 'diaria':
      return 'FREQ=DAILY';
    case 'mensal':
      return 'FREQ=MONTHLY';
    case 'anual':
      return 'FREQ=YEARLY';
    case 'personalizada':
      return escolha.regra;
    case 'semanal':
      return `FREQ=WEEKLY;BYDAY=${diasCanonicos(escolha.dias).join(',')}`;
  }
}

export function lerRepeticao(regra: string | null): Repeticao {
  if (regra === null || regra.trim() === '') {
    return { tipo: 'nao-repete' };
  }

  const lida = tentarLer(regra);

  // Regra que o próprio parser recusa (`BYSETPOS` e companhia — ver docs/08).
  // O formulário não pode quebrar ao abrir um evento assim, e salvar sem mexer
  // tem de devolver a mesma regra: aí a API recusa com a mensagem dela, em vez
  // de o formulário apagar o campo.
  if (lida === null || !ehSimples(lida)) {
    return { tipo: 'personalizada', regra };
  }

  return simplesComo(lida) ?? { tipo: 'personalizada', regra };
}

/**
 * Tudo o que o seletor **não** tem controle para editar.
 *
 * `ocorrencias` e `ate` são o fim da série; `intervalo` diferente de 1 é "a cada
 * N"; `porDiaDaSemanaNoMes` é "a segunda terça"; `porDiaDoMes` é dia explícito.
 * Qualquer um deles presente significa que mostrar uma das quatro opções
 * perderia informação ao salvar.
 */
function ehSimples(regra: Regra): boolean {
  return (
    regra.intervalo === 1 &&
    regra.ocorrencias === undefined &&
    regra.ate === undefined &&
    regra.porDiaDaSemanaNoMes === undefined &&
    regra.porDiaDoMes === undefined
  );
}

function simplesComo(regra: Regra): Repeticao | null {
  switch (regra.freq) {
    case 'DAILY':
      // `BYDAY` numa regra diária é um filtro, e o seletor não o expressa.
      return regra.porDiaDaSemana === undefined ? { tipo: 'diaria' } : null;
    case 'MONTHLY':
      return regra.porDiaDaSemana === undefined ? { tipo: 'mensal' } : null;
    case 'YEARLY':
      return regra.porDiaDaSemana === undefined ? { tipo: 'anual' } : null;
    case 'WEEKLY':
      // Semanal **sem** `BYDAY` segue o dia do início. Amarrar um dia explícito
      // mudaria o significado se a data de início também mudasse no mesmo
      // salvamento, então ela fica como personalizada.
      return regra.porDiaDaSemana === undefined
        ? null
        : { tipo: 'semanal', dias: diasCanonicos(regra.porDiaDaSemana) };
  }
}

function tentarLer(regra: string): Regra | null {
  try {
    return lerRrule(regra);
  } catch {
    return null;
  }
}

/**
 * Os dias na ordem canônica, sem repetição.
 *
 * `BYDAY=TH,TU` e `BYDAY=TU,TH` são a mesma regra para a RFC, e esta é a única
 * reescrita que o módulo se permite — ela não muda o significado.
 */
function diasCanonicos(dias: readonly DiaDaSemana[]): readonly DiaDaSemana[] {
  if (dias.length === 0) {
    throw new Error(
      'Uma repetição semanal precisa de pelo menos um dia da semana.',
    );
  }

  const escolhidos = new Set(dias);
  return ORDEM.filter((dia) => escolhidos.has(dia));
}

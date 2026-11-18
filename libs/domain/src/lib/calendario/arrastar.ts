/**
 * A conta de arrastar e redimensionar eventos na grade de horas.
 *
 * O gesto vira três perguntas, todas respondidas aqui sem navegador:
 *
 * - **Onde o ponteiro está?** `celulaDaGrade` traduz coordenadas de tela em
 *   (coluna, fração do dia), e `instanteNaGrade` traduz isso em um instante.
 * - **Quanto se moveu?** A diferença entre o instante de agora e o de quando
 *   se pegou o evento. Medida em **tempo decorrido**, e não em linhas da tela,
 *   por isso atravessa dias e dias de virada de horário de verão sem conta
 *   especial.
 * - **Para onde vai o evento?** `moverIntervalo` e `redimensionarFim`.
 *
 * O deslocamento é que é arredondado ao passo, e não o instante resultante: um
 * evento que começava às 9h05 e é movido uma hora vai para 10h05. Arredondar o
 * resultado o desalinharia de si mesmo a cada gesto, e um clique sem querer
 * mudaria o horário de quem nem arrastou.
 */
import { somarDias, type DataCivil } from '../recorrencia/civil';
import { paraInstante } from '../tempo/zona';

/** O menor movimento da grade, e a menor duração de um evento redimensionado. */
export const PASSO_EM_MINUTOS = 15;

const MS_POR_MINUTO = 60_000;

export type Horario = {
  readonly inicio: Date;
  readonly fim: Date;
};

/**
 * O instante que corresponde a uma fração do dia, sem arredondar.
 *
 * Inversa de `faixaNoDia`: a fração é sobre a duração **real** do dia (23, 24
 * ou 25 horas), a mesma que posiciona as faixas. Fora de 0..1 é recortada, para
 * um ponteiro que passou da borda não produzir um instante em outro dia.
 */
export function instanteNaGrade(entrada: {
  readonly dia: DataCivil;
  readonly fuso: string;
  readonly fracao: number;
}): Date {
  const abre = paraInstante(
    { ...entrada.dia, hora: 0, minuto: 0 },
    entrada.fuso,
  );
  const fecha = paraInstante(
    { ...somarDias(entrada.dia, 1), hora: 0, minuto: 0 },
    entrada.fuso,
  );
  const fracao = Math.min(Math.max(entrada.fracao, 0), 1);

  return new Date(
    abre.getTime() + Math.round(fracao * (fecha.getTime() - abre.getTime())),
  );
}

/** Move o evento inteiro; a duração não muda. */
export function moverIntervalo(entrada: {
  readonly inicio: Date;
  readonly fim: Date;
  readonly deslocamentoMs: number;
}): Horario {
  const passo = arredondarAoPasso(entrada.deslocamentoMs);

  return {
    inicio: new Date(entrada.inicio.getTime() + passo),
    fim: new Date(entrada.fim.getTime() + passo),
  };
}

/**
 * Move só o fim.
 *
 * Nunca abaixo de um passo de duração: um evento que encolhe até virar nada
 * sumiria da grade, e arrastar para cima do início o faria acabar antes de
 * começar. Um marco de duração zero que não foi arrastado continua marco.
 */
export function redimensionarFim(entrada: {
  readonly inicio: Date;
  readonly fim: Date;
  readonly deslocamentoMs: number;
}): Horario {
  const passo = arredondarAoPasso(entrada.deslocamentoMs);

  if (passo === 0) {
    return { inicio: entrada.inicio, fim: entrada.fim };
  }

  const menorFim = entrada.inicio.getTime() + PASSO_EM_MINUTOS * MS_POR_MINUTO;

  return {
    inicio: entrada.inicio,
    fim: new Date(Math.max(entrada.fim.getTime() + passo, menorFim)),
  };
}

/**
 * Em que coluna e a que altura do dia está um ponto da tela.
 *
 * Fora da grade o ponto cai na célula mais próxima, porque o ponteiro de quem
 * arrasta passa dos limites o tempo todo e o evento deve ficar na borda, e não
 * desaparecer. `colunas` ou `largura` zerados (grade ainda sem medida) dão a
 * coluna 0 em vez de uma divisão por zero.
 */
export function celulaDaGrade(entrada: {
  readonly x: number;
  readonly y: number;
  readonly esquerda: number;
  readonly topo: number;
  readonly largura: number;
  readonly altura: number;
  readonly colunas: number;
}): { readonly coluna: number; readonly fracao: number } {
  const larguraDaColuna =
    entrada.colunas > 0 ? entrada.largura / entrada.colunas : 0;

  const coluna =
    larguraDaColuna > 0
      ? Math.floor((entrada.x - entrada.esquerda) / larguraDaColuna)
      : 0;
  const fracao =
    entrada.altura > 0 ? (entrada.y - entrada.topo) / entrada.altura : 0;

  return {
    coluna: Math.min(Math.max(coluna, 0), Math.max(entrada.colunas - 1, 0)),
    fracao: Math.min(Math.max(fracao, 0), 1),
  };
}

function arredondarAoPasso(deslocamentoMs: number): number {
  const passoMs = PASSO_EM_MINUTOS * MS_POR_MINUTO;
  // `+ 0` normaliza o `-0` de arredondar um deslocamento pequeno e negativo.
  return Math.round(deslocamentoMs / passoMs) * passoMs + 0;
}

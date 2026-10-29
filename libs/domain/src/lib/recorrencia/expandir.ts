/**
 * Expansão de recorrência: de uma regra para as ocorrências de um intervalo.
 *
 * A decisão de guardar a regra em vez de materializar cada ocorrência está em
 * docs/03-modelo-de-dados.md. A consequência é esta função, e ela é compartilhada
 * pelo servidor e pelo navegador justamente para que os dois não divirjam.
 *
 * O raciocínio acontece em **data civil e hora de parede**, e só no fim vira
 * instante. É o que mantém "toda terça às 9h" às 9h locais depois de uma virada
 * de horário de verão — ver `tempo/zona.ts`.
 */
import { paraHoraLocal, paraInstante, type HoraLocal } from '../tempo/zona';
import {
  diaDaSemanaDe,
  resolverDiaDoMes,
  resolverDiaOrdenado,
  somarDias,
  somarMeses,
  type DataCivil,
} from './civil';
import { lerRrule, type DiaDaSemana, type Regra } from './rrule';

export type EventoRecorrente = {
  readonly inicio: Date;
  readonly fim: Date;
  /** Fuso IANA em que a regra foi escrita. */
  readonly fuso: string;
  readonly regra: string | null;
  /** Instantes de início das ocorrências removidas ("excluir só este"). */
  readonly datasExcluidas?: readonly Date[];
};

export type Intervalo = {
  readonly de: Date;
  readonly ate: Date;
};

export type Ocorrencia = {
  readonly inicio: Date;
  readonly fim: Date;
  /**
   * O início que esta ocorrência teria pela regra.
   *
   * É a identidade dela: `Event.originalStartsAt` aponta para este valor, e é
   * assim que "editar só este" substitui uma instância da série.
   */
  readonly inicioOriginal: Date;
};

/**
 * Teto de períodos examinados numa expansão.
 *
 * Sem ele, uma série diária consultada por mil anos travaria o servidor. O
 * valor cobre com folga qualquer intervalo que uma interface de calendário
 * mostre — a visão mais longa é um ano.
 */
const LIMITE_DE_PERIODOS = 20_000;

export function expandir(
  evento: EventoRecorrente,
  intervalo: Intervalo,
): Ocorrencia[] {
  if (!evento.regra) {
    return avulso(evento, intervalo);
  }

  const regra = lerRrule(evento.regra);
  const inicioLocal = paraHoraLocal(evento.inicio, evento.fuso);
  const duracao = duracaoExata(evento);
  const excluidos = new Set(
    (evento.datasExcluidas ?? []).map((d) => d.getTime()),
  );

  return percorrer({
    evento,
    intervalo,
    regra,
    inicioLocal,
    duracao,
    excluidos,
  });
}

type Contexto = {
  readonly evento: EventoRecorrente;
  readonly intervalo: Intervalo;
  readonly regra: Regra;
  readonly inicioLocal: HoraLocal;
  readonly duracao: number;
  readonly excluidos: Set<number>;
};

function percorrer(ctx: Contexto): Ocorrencia[] {
  const encontradas: Ocorrencia[] = [];
  let contadas = 0;

  for (let periodo = 0; periodo < LIMITE_DE_PERIODOS; periodo++) {
    const datas = datasDoPeriodo(ctx, periodo);

    for (const data of datas) {
      const inicio = paraInstante(
        { ...data, hora: ctx.inicioLocal.hora, minuto: ctx.inicioLocal.minuto },
        ctx.evento.fuso,
      );

      if (passouDoFim(ctx, inicio, contadas)) {
        return encontradas;
      }

      contadas++;
      acrescentarSeCabe(ctx, inicio, encontradas);
    }

    if (datas.length > 0 && jaPassouDoIntervalo(ctx, datas)) {
      return encontradas;
    }
  }

  throw new Error(
    `Expansão de recorrência excedeu o limite de ${LIMITE_DE_PERIODOS} períodos. Reduza o intervalo consultado ou dê um fim à série.`,
  );
}

/** `UNTIL` e `COUNT`: os dois encerram a série, nunca os dois juntos. */
function passouDoFim(ctx: Contexto, inicio: Date, contadas: number): boolean {
  if (ctx.regra.ate && inicio.getTime() > ctx.regra.ate.getTime()) {
    return true;
  }

  return (
    ctx.regra.ocorrencias !== undefined && contadas >= ctx.regra.ocorrencias
  );
}

function acrescentarSeCabe(
  ctx: Contexto,
  inicio: Date,
  destino: Ocorrencia[],
): void {
  // A exclusão vem **depois** da contagem: `COUNT=4` com duas exclusões dá
  // duas ocorrências, porque a contagem é da regra.
  if (ctx.excluidos.has(inicio.getTime())) {
    return;
  }

  const fim = new Date(inicio.getTime() + ctx.duracao);
  if (seCruzam({ inicio, fim }, ctx.intervalo)) {
    destino.push({ inicio, fim, inicioOriginal: inicio });
  }
}

/**
 * Para de iterar quando as datas do período já passaram do intervalo.
 *
 * Só vale quando a série não tem `COUNT` nem `UNTIL` pendente de contagem — e
 * vale sempre, porque as datas crescem monotonicamente.
 */
function jaPassouDoIntervalo(ctx: Contexto, datas: DataCivil[]): boolean {
  const ultima = datas[datas.length - 1];
  if (!ultima) {
    return false;
  }

  const instante = paraInstante(
    { ...ultima, hora: ctx.inicioLocal.hora, minuto: ctx.inicioLocal.minuto },
    ctx.evento.fuso,
  );

  return instante.getTime() >= ctx.intervalo.ate.getTime();
}

function datasDoPeriodo(ctx: Contexto, periodo: number): DataCivil[] {
  const base: DataCivil = {
    ano: ctx.inicioLocal.ano,
    mes: ctx.inicioLocal.mes,
    dia: ctx.inicioLocal.dia,
  };
  const salto = periodo * ctx.regra.intervalo;

  switch (ctx.regra.freq) {
    case 'DAILY':
      return filtrarPorDia(ctx.regra, [somarDias(base, salto)]);
    case 'WEEKLY':
      return datasDaSemana(ctx.regra, base, salto);
    case 'MONTHLY':
      return datasDoMes(ctx.regra, base, salto);
    case 'YEARLY':
      return datasDoAno(base, salto);
  }
}

/** `BYDAY` numa regra diária funciona como filtro, não como gerador. */
function filtrarPorDia(regra: Regra, datas: DataCivil[]): DataCivil[] {
  const dias = regra.porDiaDaSemana;
  if (!dias) {
    return datas;
  }

  return datas.filter((d) => dias.includes(diaDaSemanaDe(d)));
}

/**
 * A semana começa na segunda.
 *
 * `WKST` não é suportado — ver `rrule.ts`. Fixar a segunda é o que vale para
 * pt-BR e para a maioria da Europa; mudar isso é alterar qual semana contém o
 * dia, e por isso é recusado em vez de silenciosamente assumido.
 */
function datasDaSemana(
  regra: Regra,
  base: DataCivil,
  salto: number,
): DataCivil[] {
  const ordem: readonly DiaDaSemana[] = [
    'MO',
    'TU',
    'WE',
    'TH',
    'FR',
    'SA',
    'SU',
  ];
  const dias = regra.porDiaDaSemana ?? [diaDaSemanaDe(base)];

  const deslocamentoDaBase = ordem.indexOf(diaDaSemanaDe(base));
  const segundaDaSemana = somarDias(base, -deslocamentoDaBase + salto * 7);

  return ordem
    .map((dia, indice) => ({ dia, indice }))
    .filter(({ dia }) => dias.includes(dia))
    .map(({ indice }) => somarDias(segundaDaSemana, indice));
}

function datasDoMes(regra: Regra, base: DataCivil, salto: number): DataCivil[] {
  const { ano, mes } = somarMeses(base.ano, base.mes, salto);

  if (regra.porDiaDaSemanaNoMes) {
    return regra.porDiaDaSemanaNoMes
      .map(({ ordem, dia }) => resolverDiaOrdenado(ano, mes, ordem, dia))
      .filter((dia): dia is number => dia !== null)
      .sort((a, b) => a - b)
      .map((dia) => ({ ano, mes, dia }));
  }

  const pedidos = regra.porDiaDoMes ?? [base.dia];

  return pedidos
    .map((pedido) => resolverDiaDoMes(ano, mes, pedido))
    .filter((dia): dia is number => dia !== null)
    .sort((a, b) => a - b)
    .map((dia) => ({ ano, mes, dia }));
}

/** 29 de fevereiro numa regra anual só ocorre em ano bissexto. */
function datasDoAno(base: DataCivil, salto: number): DataCivil[] {
  const ano = base.ano + salto;
  const dia = resolverDiaDoMes(ano, base.mes, base.dia);

  return dia === null ? [] : [{ ano, mes: base.mes, dia }];
}

/**
 * A duração exata, em milissegundos — a mesma da primeira ocorrência.
 *
 * Para o caso comum isto é indistinguível da duração "nominal" (de parede): um
 * evento de 09:00 às 10:00 continua de 09:00 às 10:00 locais depois da virada,
 * porque as duas pontas deslocam juntas.
 *
 * As duas interpretações só divergem num evento que **atravessa** a virada, e
 * aí a escolha é a duração exata, como a RFC 5545 define para evento com hora
 * e `DTEND`: uma reunião de três horas continua de três horas. O efeito
 * visível é que, na noite em que o relógio volta, ela termina uma hora mais
 * cedo no relógio — 23:00 às 01:00 em vez de 23:00 às 02:00.
 *
 * A primeira versão desta função calculava a duração de parede e somava ao
 * instante, o que era um híbrido sem definição clara. E o teste que eu havia
 * escrito para ela **não distinguia as duas**, porque usava um evento de uma
 * hora que não atravessa virada nenhuma.
 */
function duracaoExata(evento: EventoRecorrente): number {
  return evento.fim.getTime() - evento.inicio.getTime();
}

function avulso(evento: EventoRecorrente, intervalo: Intervalo): Ocorrencia[] {
  const ocorrencia = {
    inicio: evento.inicio,
    fim: evento.fim,
    inicioOriginal: evento.inicio,
  };

  return seCruzam(ocorrencia, intervalo) ? [ocorrencia] : [];
}

/**
 * Sobreposição, não contenção — num intervalo **semiaberto**: `[de, ate)`.
 *
 * A viagem que começou no mês passado e termina neste tem de aparecer na visão
 * deste mês; filtrar só por data de início a esconderia.
 *
 * Semiaberto porque a visão de um dia vai da meia-noite dele à meia-noite do
 * seguinte, e dois dias consecutivos não podem reivindicar o mesmo instante. A
 * primeira versão fechava a borda de baixo (`fim >= de`), e isso só ficou
 * visível quando o evento de dia inteiro passou a ter fim exclusivo (ver
 * `agendas/dia-inteiro.ts`): o dia inteiro do dia 15 termina exatamente na
 * meia-noite que abre o 16, e aparecia nas duas visões.
 *
 * O marco de duração zero é a exceção, e por isso está escrito: `fim > de` o
 * descartaria do intervalo que começa exatamente nele, e um evento sem duração
 * ("entrega do relatório") não apareceria em visão nenhuma. Tratado como ponto,
 * ele cai em exatamente um dos dois intervalos vizinhos.
 */
function seCruzam(
  evento: { inicio: Date; fim: Date },
  intervalo: Intervalo,
): boolean {
  const inicio = evento.inicio.getTime();
  const fim = evento.fim.getTime();
  const de = intervalo.de.getTime();
  const ate = intervalo.ate.getTime();

  if (inicio >= ate) {
    return false;
  }

  return fim === inicio ? inicio >= de : fim > de;
}

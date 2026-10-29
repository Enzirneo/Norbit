/**
 * Normalização de evento de dia inteiro.
 *
 * `isAllDay` é só uma marca; o que define o comportamento é o que está gravado
 * em `startsAt` e `endsAt`. Sem uma normalização única, o mesmo "dia 15" chega
 * de três clientes em três formas — meia-noite local, 23:59:59, meia-noite UTC —
 * e o evento aparece no dia errado para quem não está no fuso do servidor.
 *
 * A forma canônica é **meia-noite local a meia-noite local**, com o fim
 * exclusivo, como a RFC 5545 define para `DTEND` em forma de data. Fim exclusivo
 * é o que faz a conta de sobreposição fechar sem um a-menos: um dia inteiro tem
 * a duração de um dia, e não de 23:59:59.
 */
import { paraHoraLocal, paraInstante } from '../tempo/zona';
import { somarDias, type DataCivil } from '../recorrencia/civil';

export type DiaInteiro = {
  readonly inicio: Date;
  readonly fim: Date;
  /** Fuso IANA do evento — nunca o do servidor. */
  readonly fuso: string;
};

export function normalizarDiaInteiro(entrada: DiaInteiro): {
  inicio: Date;
  fim: Date;
} {
  const diaDoInicio = diaCivilDe(entrada.inicio, entrada.fuso);
  const inicio = meiaNoiteDe(diaDoInicio, entrada.fuso);

  return {
    inicio,
    fim: meiaNoiteDe(diaExclusivo(entrada, diaDoInicio), entrada.fuso),
  };
}

/**
 * O dia que serve de limite exclusivo.
 *
 * Quando o fim já chega exatamente na meia-noite local, ele **é** o limite
 * exclusivo e não ganha um dia. É o que torna a função idempotente, e a
 * idempotência é o que resolve a ambiguidade do que chega: sem ela, um PATCH que
 * não mexe nas datas empurraria o evento um dia para frente a cada salvamento.
 *
 * O piso de um dia cobre o caso que a própria idempotência cria: fim na
 * meia-noite do dia de início daria um evento de nenhum dia.
 */
function diaExclusivo(entrada: DiaInteiro, diaDoInicio: DataCivil): DataCivil {
  const diaDoFim = diaCivilDe(entrada.fim, entrada.fuso);
  const chegouNaMeiaNoite =
    entrada.fim.getTime() === meiaNoiteDe(diaDoFim, entrada.fuso).getTime();

  const candidato = chegouNaMeiaNoite ? diaDoFim : somarDias(diaDoFim, 1);
  const minimo = somarDias(diaDoInicio, 1);

  return ordinal(candidato) > ordinal(minimo) ? candidato : minimo;
}

function diaCivilDe(instante: Date, fuso: string): DataCivil {
  const { ano, mes, dia } = paraHoraLocal(instante, fuso);
  return { ano, mes, dia };
}

/**
 * A meia-noite local do dia.
 *
 * Em fusos que viram à meia-noite ela pode não existir, e aí vale a política de
 * `paraInstante`: empurrar para frente. Um dia inteiro que começa 01:00 é
 * preferível a um dia inteiro que não existe.
 */
function meiaNoiteDe(dia: DataCivil, fuso: string): Date {
  return paraInstante({ ...dia, hora: 0, minuto: 0 }, fuso);
}

/** Compara datas civis sem converter para instante, que é mais caro e circular. */
function ordinal(dia: DataCivil): number {
  return dia.ano * 10_000 + dia.mes * 100 + dia.dia;
}

/**
 * Rótulos e formatação da grade de horas.
 *
 * Funções puras de texto, sem estado: moram fora do componente para ele só
 * cuidar de montar colunas e faixas. O que depende do relógio ou do fuso chega
 * por parâmetro.
 */
import type { OcorrenciaVisivel } from '@norbit/contracts';
import type { DataCivil, MarcaDeHora } from '@norbit/domain';

/** Uma hora clicável, posicionada pela fração real daquele dia. */
export type CelulaDeHora = {
  readonly hora: number;
  readonly topo: number;
  readonly altura: number;
  readonly rotulo: string;
  readonly texto: string;
};

/**
 * A hora de início ("09:00") ou, durante um arrasto, o intervalo ("09:00 –
 * 10:00"): é o que mostra à pessoa onde o evento vai cair antes de soltar.
 */
export function horarioDe(
  ocorrencia: OcorrenciaVisivel,
  fuso: string,
  vinteEQuatro: boolean,
  comFim: boolean,
): string {
  const formatador = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: !vinteEQuatro,
    timeZone: fuso,
  });
  const inicio = formatador.format(new Date(ocorrencia.inicio));

  return comFim
    ? `${inicio} – ${formatador.format(new Date(ocorrencia.fim))}`
    : inicio;
}

/** "Qua" — formatado em UTC porque a entrada é data civil. Ver visao-de-mes.ts. */
export function rotuloCurtoDe(dia: DataCivil): string {
  const texto = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(dia.ano, dia.mes - 1, dia.dia)));

  return texto.replace('.', '').replace(/^./, (l) => l.toUpperCase());
}

export function mesmoDia(a: DataCivil, b: DataCivil): boolean {
  return a.ano === b.ano && a.mes === b.mes && a.dia === b.dia;
}

/** -1 se `a` vem antes de `b`, 1 se vem depois, 0 se é o mesmo dia. */
export function compararDias(a: DataCivil, b: DataCivil): -1 | 0 | 1 {
  const diferenca = a.ano - b.ano || a.mes - b.mes || a.dia - b.dia;
  return Math.sign(diferenca) as -1 | 0 | 1;
}

/**
 * Quanto de uma coluna, de cima para baixo, já é passado: de 0 a 100.
 *
 * Um dia que acabou escurece inteiro, um que ainda vem não escurece, e hoje
 * escurece até a linha de agora. É a hierarquia de tempo da grade: o passado
 * recua, e o que sobra em destaque é o que ainda dá para fazer.
 *
 * `agora` é a posição da linha de agora em hoje, em porcentagem, ou `null` se
 * ela está fora da grade.
 */
export function fracaoDoPassado(
  dia: DataCivil,
  hoje: DataCivil,
  agora: number | null,
): number {
  const ordem = compararDias(dia, hoje);

  if (ordem < 0) {
    return 100;
  }

  return ordem === 0 ? (agora ?? 0) : 0;
}

export function comoTexto(dia: DataCivil): string {
  return `${dia.ano}-${dois(dia.mes)}-${dois(dia.dia)}`;
}

export function dois(valor: number): string {
  return String(valor).padStart(2, '0');
}

/**
 * As horas de um dia como células clicáveis.
 *
 * Cada uma é um `button`: é o que dá acesso por teclado a criar um evento num
 * horário. A primeira versão usava um `div` com `(click)` e calculava a hora
 * pela posição vertical do cursor — mais preciso para o mouse, e **inalcançável**
 * para quem navega por teclado. O lint apontou, e estava certo.
 *
 * A altura de cada célula é a distância até a hora seguinte, e não 1/24: num dia
 * de 23 ou 25 horas as células precisam acompanhar as marcas, ou a grade mostra
 * uma linha num lugar e aceita o clique em outro.
 */
export function celulasDeHora(
  dia: DataCivil,
  marcas: readonly MarcaDeHora[],
  vinteEQuatro: boolean,
): readonly CelulaDeHora[] {
  return marcas.map((marca, i) => {
    const proxima = marcas[i + 1]?.posicao ?? 1;

    return {
      hora: marca.hora,
      topo: marca.posicao * 100,
      altura: (proxima - marca.posicao) * 100,
      // O valor do campo de hora é sempre 24h: é o formato que o
      // `<input type="time">` exige, independente de como a pessoa lê o relógio.
      texto: `${dois(marca.hora)}:00`,
      rotulo: `Criar evento às ${rotuloDeHora(marca.hora, vinteEQuatro)} de ${rotuloLongoDe(dia)}`,
    };
  });
}

/** "15 de junho", para o rótulo acessível do botão de hora. */
export function rotuloLongoDe(dia: DataCivil): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(dia.ano, dia.mes - 1, dia.dia)));
}

/**
 * A hora como a pessoa lê: "14h" ou "2 PM".
 *
 * Só para **mostrar**. O valor que vai para o formulário continua em 24 horas,
 * porque é o formato que o `<input type="time">` exige — misturar os dois faria
 * o campo nascer vazio para quem escolheu 12 horas.
 */
export function rotuloDeHora(hora: number, vinteEQuatro: boolean): string {
  if (vinteEQuatro) {
    return `${hora}h`;
  }

  const periodo = hora < 12 ? 'AM' : 'PM';
  const doze = hora % 12 === 0 ? 12 : hora % 12;

  return `${doze} ${periodo}`;
}

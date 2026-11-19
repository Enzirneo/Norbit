/**
 * A fase da lua de um dia, e o desenho dela.
 *
 * A lua aparece no calendário como **informação**: em cada dia, a fase; num
 * cartão, o nome e quanto dela está iluminada. Por isso a conta mora aqui, em
 * função pura, com teste, e a tela só desenha o que ela devolve.
 *
 * Precisão: o modelo é o do **mês sinódico médio** (29,530588853 dias) a partir
 * de uma lua nova conhecida. Ele erra por até cerca de meio dia, porque a órbita
 * real acelera e desacelera, e isso basta para um calendário: a fase mostrada é
 * a certa quando a lua está na quarta parte, e pode adiantar ou atrasar um dia
 * na virada de nova para crescente. **Não é uma efeméride** e não deve ser usado
 * como tal.
 *
 * A orientação do desenho depende do hemisfério: no sul, a lua crescente aparece
 * iluminada à esquerda, e no norte, à direita. O padrão do produto é o sul.
 */
import type { DataCivil } from '../recorrencia/civil';

/** O intervalo médio entre duas luas novas, em dias. */
export const DIAS_DO_MES_SINODICO = 29.530588853;

/** Uma lua nova real: 6 de janeiro de 2000, 18h14 UTC. */
const LUA_NOVA_DE_REFERENCIA = Date.UTC(2000, 0, 6, 18, 14);

const MS_POR_DIA = 86_400_000;

export type Hemisferio = 'sul' | 'norte';
export type LadoIluminado = 'esquerda' | 'direita';

export type NomeDeFase =
  | 'Lua nova'
  | 'Crescente'
  | 'Quarto crescente'
  | 'Gibosa crescente'
  | 'Lua cheia'
  | 'Gibosa minguante'
  | 'Quarto minguante'
  | 'Minguante';

/**
 * A fase num instante: 0 é lua nova, 0,25 quarto crescente, 0,5 lua cheia,
 * 0,75 quarto minguante. Sempre em [0, 1), inclusive antes da referência.
 */
export function faseDaLua(instante: Date): number {
  const dias = (instante.getTime() - LUA_NOVA_DE_REFERENCIA) / MS_POR_DIA;
  const fase = (dias / DIAS_DO_MES_SINODICO) % 1;

  // `%` conserva o sinal: antes da referência o resto vem negativo.
  return fase < 0 ? fase + 1 : fase;
}

/**
 * A fase de um dia civil, avaliada ao meio-dia (UTC).
 *
 * Meio-dia porque é o meio do dia: o erro de escolher outro instante é menor que
 * o do próprio modelo, e fixar o instante faz o mesmo dia dar a mesma fase em
 * qualquer fuso.
 */
export function faseDoDia(dia: DataCivil): number {
  return faseDaLua(new Date(Date.UTC(dia.ano, dia.mes - 1, dia.dia, 12)));
}

/** Quanto do disco está iluminado, de 0 a 100. */
export function iluminacao(fase: number): number {
  return Math.round(((1 - Math.cos(2 * Math.PI * fase)) / 2) * 100);
}

export function nomeDaFase(fase: number): NomeDeFase {
  if (fase < 0.03 || fase > 0.97) return 'Lua nova';
  if (fase < 0.22) return 'Crescente';
  if (fase < 0.28) return 'Quarto crescente';
  if (fase < 0.47) return 'Gibosa crescente';
  if (fase < 0.53) return 'Lua cheia';
  if (fase < 0.72) return 'Gibosa minguante';
  if (fase < 0.78) return 'Quarto minguante';
  return 'Minguante';
}

/**
 * De que lado a lua aparece iluminada.
 *
 * Crescente (fase < 0,5) no sul: à esquerda. Minguante: à direita. No norte, o
 * oposto. É a única parte do desenho que depende do hemisfério.
 */
export function ladoIluminado(
  fase: number,
  hemisferio: Hemisferio,
): LadoIluminado {
  const crescendo = fase < 0.5;
  return crescendo === (hemisferio === 'sul') ? 'esquerda' : 'direita';
}

/**
 * O caminho SVG da parte **iluminada**, num disco de raio `raio` centrado na
 * origem.
 *
 * É um arco do contorno (do lado iluminado) fechado pela elipse do terminador,
 * a linha entre o claro e o escuro. A largura da elipse é `|cos(2π·fase)|`:
 * zero nos quartos (terminador reto), igual ao raio na lua nova e na cheia. Se
 * o terminador curva para o lado iluminado, a parte clara é uma foice
 * (crescente ou minguante); se curva para o escuro, é gibosa.
 *
 * As flags de varredura do SVG são o que deixa isto difícil de ler, e é por
 * isso que o teste confere o caminho inteiro nas fases que importam.
 */
export function caminhoDaLua(
  fase: number,
  raio: number,
  hemisferio: Hemisferio,
): string {
  const c = Math.cos(2 * Math.PI * fase);
  const emFoice = c > 0;
  const aEsquerda = ladoIluminado(fase, hemisferio) === 'esquerda';

  const contorno = aEsquerda ? 0 : 1;
  const terminador = aEsquerda === emFoice ? 1 : 0;
  const largura = numero(Math.abs(c) * raio);

  return (
    `M0 ${-raio} A${raio} ${raio} 0 0 ${contorno} 0 ${raio} ` +
    `A${largura} ${raio} 0 0 ${terminador} 0 ${-raio}Z`
  );
}

/** Duas casas e sem zeros à direita: `8.09`, `10`, `0`. */
function numero(valor: number): string {
  return String(Number(valor.toFixed(2)));
}

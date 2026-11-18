/**
 * O gesto de arrastar ou redimensionar um evento, sem saber de DOM.
 *
 * Uma máquina de estados pequena: o componente liga os eventos do navegador a
 * `iniciar`, `mover`, `soltar` e `cancelar`, e este objeto responde com o
 * intervalo provisório. Quem converte coordenadas de tela em instantes é
 * `instanteEm`, injetada: assim o gesto se testa sem navegador, e a conta de
 * tempo continua em `libs/domain`.
 *
 * A distinção que justifica a classe é **clique ou arrasto**. Um botão de
 * evento ainda abre o formulário ao ser clicado; só passado um limiar de
 * movimento o gesto vira arrasto, e o clique que o navegador dispara ao soltar
 * precisa ser engolido (o componente decide isso por `moveu`).
 */
import { moverIntervalo, redimensionarFim, type Horario } from '@norbit/domain';

/** Quanto o ponteiro precisa andar antes de o clique virar arrasto. */
export const LIMIAR_DO_ARRASTO_EM_PX = 4;

export type ModoDeArrasto = 'mover' | 'redimensionar';

type Estado = {
  readonly modo: ModoDeArrasto;
  readonly x: number;
  readonly y: number;
  readonly instanteInicial: Date;
  readonly original: Horario;
  moveu: boolean;
  atual: Horario;
};

export class GestoDeArrasto {
  private estado: Estado | null = null;

  constructor(private readonly instanteEm: (x: number, y: number) => Date) {}

  get emAndamento(): boolean {
    return this.estado !== null;
  }

  iniciar(entrada: {
    readonly x: number;
    readonly y: number;
    readonly modo: ModoDeArrasto;
    readonly inicio: Date;
    readonly fim: Date;
  }): void {
    const original = { inicio: entrada.inicio, fim: entrada.fim };

    this.estado = {
      modo: entrada.modo,
      x: entrada.x,
      y: entrada.y,
      instanteInicial: this.instanteEm(entrada.x, entrada.y),
      original,
      moveu: false,
      atual: original,
    };
  }

  /**
   * O intervalo provisório para a posição do ponteiro, ou `null` enquanto o
   * movimento ainda cabe num clique (ou não há gesto).
   */
  mover(x: number, y: number): Horario | null {
    const estado = this.estado;
    if (!estado) {
      return null;
    }

    if (!estado.moveu && !passouDoLimiar(estado, x, y)) {
      return null;
    }

    estado.moveu = true;
    estado.atual = this.calcular(estado, x, y);
    return estado.atual;
  }

  /**
   * Encerra o gesto. `moveu` diz se foi arrasto (o clique seguinte deve ser
   * engolido); `intervalo` é o que gravar, ou `null` quando nada mudou — o
   * ponteiro pode ter voltado ao ponto de partida.
   */
  soltar(): { moveu: boolean; intervalo: Horario | null } {
    const estado = this.estado;
    this.estado = null;

    if (!estado?.moveu) {
      return { moveu: false, intervalo: null };
    }

    return {
      moveu: true,
      intervalo: igual(estado.atual, estado.original) ? null : estado.atual,
    };
  }

  cancelar(): void {
    this.estado = null;
  }

  private calcular(estado: Estado, x: number, y: number): Horario {
    const deslocamentoMs =
      this.instanteEm(x, y).getTime() - estado.instanteInicial.getTime();
    const entrada = { ...estado.original, deslocamentoMs };

    return estado.modo === 'mover'
      ? moverIntervalo(entrada)
      : redimensionarFim(entrada);
  }
}

function passouDoLimiar(estado: Estado, x: number, y: number): boolean {
  return Math.hypot(x - estado.x, y - estado.y) >= LIMIAR_DO_ARRASTO_EM_PX;
}

function igual(a: Horario, b: Horario): boolean {
  return (
    a.inicio.getTime() === b.inicio.getTime() &&
    a.fim.getTime() === b.fim.getTime()
  );
}

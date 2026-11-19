/**
 * A lua: o disco e a parte iluminada de uma fase.
 *
 * Nenhuma conta aqui. A fase, o nome, a iluminação e o caminho do desenho vêm de
 * `libs/domain` (`lua.ts`), com teste; este componente só os coloca num SVG. As
 * cores são tokens, então a lua acompanha o tema.
 *
 * O desenho é feito sempre no mesmo raio, num `viewBox` fixo, e o tamanho em
 * pixels só escala o SVG: assim o traço fino do contorno e o desenho não mudam
 * com o tamanho.
 */
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import {
  caminhoDaLua,
  iluminacao,
  nomeDaFase,
  type Hemisferio,
} from '@norbit/domain';

/** O raio do disco, em unidades do `viewBox`. Sobra 1 unidade para o contorno. */
export const RAIO_DO_DESENHO = 9;

/** O `viewBox` centrado na origem, com a folga do contorno. */
const LADO_DO_VIEWBOX = (RAIO_DO_DESENHO + 1) * 2;

@Component({
  selector: 'nb-lua',
  template: `
    <svg
      [attr.width]="tamanho()"
      [attr.height]="tamanho()"
      [attr.viewBox]="viewBox"
      role="img"
      [attr.aria-label]="rotulo()"
    >
      <circle class="disco" [attr.r]="raio" />
      <path class="luz" [attr.d]="caminho()" />
    </svg>
  `,
  styleUrl: './lua.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Lua {
  /** De 0 (lua nova) a 1, como `faseDaLua` devolve. */
  readonly fase = input.required<number>();
  /** Lado do quadrado, em pixels. */
  readonly tamanho = input(14);
  /** No sul, a crescente é iluminada à esquerda. O padrão do produto é o sul. */
  readonly hemisferio = input<Hemisferio>('sul');

  protected readonly raio = RAIO_DO_DESENHO;
  protected readonly viewBox = `${-LADO_DO_VIEWBOX / 2} ${-LADO_DO_VIEWBOX / 2} ${LADO_DO_VIEWBOX} ${LADO_DO_VIEWBOX}`;

  protected readonly caminho = computed(() =>
    caminhoDaLua(this.fase(), RAIO_DO_DESENHO, this.hemisferio()),
  );

  protected readonly rotulo = computed(
    () => `${nomeDaFase(this.fase())}, ${iluminacao(this.fase())}% iluminada`,
  );
}

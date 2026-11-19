/**
 * A camada de **forma**: cantos, sombras, vidro, brilho, estrelas e alvo de toque.
 *
 * A camada semântica cobre cor; a forma é o que sobra para a interface ter
 * jeito. Parte dela é **escolha de quem usa** (os cantos e as estrelas), e é por
 * isso que existe um valor-base, `--r`, do qual todos os raios derivam: uma
 * pessoa que leva o controle de "retos" a "redondos" mexe em um número, e a
 * tela inteira responde, sem nenhum componente saber disso.
 *
 * O evento é **sempre mais reto** que a moldura (`--r-ev`). É a regra que
 * quebra o "tudo arredondado": a moldura é macia e o conteúdo tem borda firme,
 * em qualquer valor que a pessoa escolha.
 *
 * Ver docs/superpowers/specs/2026-11-19-design-system-design.md, seção 4.1.
 */

/** O que a pessoa escolhe. Guardado em `UserSettings.theme.forma`. */
export type Forma = {
  /** Raio-base, em pixels, de 0 (retos) a 16 (redondos). */
  readonly cantos: number;
  /** Liga o campo de estrelas do fundo. */
  readonly estrelas: boolean;
};

export const CANTOS_MINIMO = 0;
export const CANTOS_MAXIMO = 16;

export const FORMA_PADRAO: Forma = Object.freeze({
  cantos: 6,
  estrelas: true,
});

/**
 * Quantas vezes o raio-base cada tamanho vale.
 *
 * Em constante, e não só dentro do CSS, para um teste poder garantir a ordem
 * (evento < pequeno < médio < tela): é ela que mantém o conteúdo mais reto que
 * a moldura para qualquer valor de `--r`.
 */
export const MULTIPLICADORES_DE_RAIO = Object.freeze({
  evento: 0.35,
  pequeno: 1,
  medio: 1.6,
  tela: 2.2,
});

/**
 * O que a pessoa escolheu, como custom properties.
 *
 * Só estas duas são **escolha**: o resto de `FORMA_DERIVADA` se expressa em
 * função de `--r` no próprio CSS, então não precisa ser recalculado quando os
 * cantos mudam.
 *
 * Recusa o que não cabe na faixa. O contrato da API (`temaSchema`) já recusa
 * antes, então um valor ruim aqui é defeito de quem chamou, e esconder isso com
 * um arredondamento só adiaria o sintoma.
 */
export function tokensDeForma(forma: Forma): Record<string, string> {
  const { cantos, estrelas } = forma;

  if (
    !Number.isInteger(cantos) ||
    cantos < CANTOS_MINIMO ||
    cantos > CANTOS_MAXIMO
  ) {
    throw new RangeError(
      `Cantos precisa ser um inteiro de ${CANTOS_MINIMO} a ${CANTOS_MAXIMO}: recebi ${cantos}.`,
    );
  }

  return {
    '--r': `${cantos}px`,
    '--estrelas': estrelas ? '1' : '0',
  };
}

/**
 * A forma que **deriva** das escolhas, e a que não depende delas.
 *
 * Vai para o `:root` do CSS gerado. Os raios são `calc` sobre `var(--r)`; o
 * brilho usa `var(--accent)`, então acompanha o destaque do tema.
 *
 * As sombras são preto translúcido de propósito: sombra é ausência de luz, e
 * não muda com o tema.
 */
export const FORMA_DERIVADA = Object.freeze({
  '--raio-p': `calc(var(--r) * ${MULTIPLICADORES_DE_RAIO.pequeno})`,
  '--raio-m': `calc(var(--r) * ${MULTIPLICADORES_DE_RAIO.medio})`,
  '--raio-tela': `calc(var(--r) * ${MULTIPLICADORES_DE_RAIO.tela})`,
  '--r-ev': `calc(var(--r) * ${MULTIPLICADORES_DE_RAIO.evento})`,
  /** Círculo e pílula: independe dos cantos escolhidos. */
  '--raio-pilula': '9999px',

  '--sombra-1': '0 1px 2px rgb(0 0 0 / 0.35)',
  '--sombra-2': '0 8px 24px rgb(0 0 0 / 0.4)',
  '--sombra-3': '0 18px 40px rgb(0 0 0 / 0.5)',

  '--vidro-desfoque': '6px',
  '--brilho-destaque':
    '0 0 14px color-mix(in oklab, var(--accent) 35%, transparent)',

  /** Horas, minutos e números que precisam alinhar: a fonte monoespaçada. */
  '--fonte-mono':
    "ui-monospace, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace",

  /** Altura mínima de um controle clicável: mouse e dedo. */
  '--alvo-toque': '2rem',
  '--alvo-toque-grosso': '2.75rem',
});

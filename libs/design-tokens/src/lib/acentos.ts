/**
 * A cor de destaque escolhida pela pessoa, e as cores que derivam dela.
 *
 * O `semanticos.ts` escolheu `textOnAccent` e `accentMuted` **à mão**, por
 * medição, para o acento do `nebula` — e deixou escrito que derivá-las para
 * qualquer acento era a Fase 4. É este arquivo.
 *
 * Por que não um seletor de cor livre: `accentHover` e `accentMuted` precisam
 * manter contraste, e o acento do usuário pode ser qualquer coisa. Derivar com
 * garantia para o espectro inteiro exige trabalhar em OKLCH (claridade
 * perceptual), e é entrega própria. Até lá, a oferta é uma **paleta curada** —
 * cinco acentos, cada um verificado pelo mesmo teste que reprova a build.
 *
 * O que já é derivado, e não escolhido a dedo:
 *
 * - **a frente** (`textOnAccent`): a que tiver mais contraste entre o quase
 *   preto e o quase branco, e recusa se nenhuma das duas alcançar o AA;
 * - **o `accentMuted`**: encontrado por busca, misturando o acento com a
 *   superfície até o texto primário passar em cima. Era `#1F2547` fixo.
 */
import { MINIMO_TEXTO, contraste, luminancia } from './contraste';
import { accent, dust, space } from './primitives';

/**
 * Os acentos que o produto oferece.
 *
 * Cinco, e não um seletor livre, pela razão acima. Cada um passa pelo teste de
 * contraste em `acentos.spec.ts`.
 */
export const ACENTOS = {
  nebula: accent.nebula,
  aurora: accent.aurora,
  solar: accent.solar,
  pulsar: accent.pulsar,
  cosmos: accent.cosmos,
} as const;

export type NomeDeAcento = keyof typeof ACENTOS;

/** Os valores, para quem precisa validar uma escolha que veio de fora. */
export const VALORES_DE_ACENTO: readonly string[] = Object.freeze(
  Object.values(ACENTOS),
);

export type DerivacaoDeAcento = {
  readonly accent: string;
  readonly accentHover: string;
  readonly accentMuted: string;
  readonly textOnAccent: string;
};

/** As duas frentes possíveis: o quase preto e o quase branco da paleta. */
const FRENTES = [space.space900, dust.dust000] as const;

/**
 * O quanto o `hover` precisa se distinguir do acento.
 *
 * 1.15:1 é pouco como contraste e inequívoco como "mudou alguma coisa". Um
 * número, e não uma porcentagem de mistura: uma porcentagem fixa muda muito num
 * acento escuro e **quase nada** num claro — medido, clarear o `aurora` em 12%
 * dava 1.046:1, que ninguém vê.
 */
const DISTANCIA_DO_HOVER = 1.15;

/**
 * Acima desta luminância o `hover` escurece em vez de clarear.
 *
 * Um acento já claro não tem para onde clarear: a diferença fica invisível. Os
 * acentos oferecidos vão de 0.25 (`nebula`) a 0.57 (`aurora`), então o corte em
 * 0.45 separa os que clareiam dos que escurecem.
 */
const LUMINANCIA_DE_CORTE = 0.45;

export function derivarAcento(cor: string): DerivacaoDeAcento {
  const textOnAccent = melhorFrente(cor);

  return {
    accent: cor,
    accentHover: hoverDe(cor),
    accentMuted: fundoMudo(cor),
    textOnAccent,
  };
}

/**
 * O `hover`: o acento afastado na direção que tem espaço.
 *
 * Por busca, como o `accentMuted`, e não por porcentagem fixa de mistura: a
 * mesma porcentagem muda muito num acento escuro e quase nada num claro. A busca
 * para no primeiro passo que alcança a distância, para o hover ser o mais
 * próximo possível do acento e ainda assim perceptível.
 */
function hoverDe(cor: string): string {
  const direcao =
    luminancia(cor) > LUMINANCIA_DE_CORTE ? space.space900 : dust.dust000;

  for (let peso = 4; peso <= 60; peso += 2) {
    const candidato = misturar(cor, direcao, peso / 100);

    if (contraste(candidato, cor) >= DISTANCIA_DO_HOVER) {
      return candidato;
    }
  }

  throw new Error(
    `Não foi possível derivar um hover perceptível para "${cor}".`,
  );
}

/**
 * A frente com mais contraste sobre o acento.
 *
 * Recusa quando nenhuma das duas alcança o AA. Não é hipótese remota: existe uma
 * faixa estreita de tons médios em que o quase preto e o quase branco da paleta
 * ficam **os dois** abaixo de 4.5:1 — e um botão desses é ilegível para quem
 * precisa do mínimo, enquanto parece aceitável para quem não precisa.
 */
export function melhorFrente(cor: string): string {
  const melhor = FRENTES.reduce((atual, candidata) =>
    contraste(candidata, cor) > contraste(atual, cor) ? candidata : atual,
  );

  const razao = contraste(melhor, cor);
  if (razao < MINIMO_TEXTO) {
    throw new Error(
      `A cor de destaque "${cor}" não alcança o contraste mínimo de ${MINIMO_TEXTO}:1 com nenhuma das frentes da paleta (melhor caso: ${razao.toFixed(2)}:1).`,
    );
  }

  return melhor;
}

/**
 * A tinta mínima do fundo de seleção, como contraste com a superfície.
 *
 * O critério **não** é "passa no contraste do texto": isso é satisfeito numa
 * faixa larguíssima de diluições, das mais sutis às mais saturadas. O que define
 * um fundo de seleção é outra coisa — tinta perceptível e ainda assim **fundo**.
 *
 * 1.25:1 é o valor que reproduz o `#1F2547` escolhido à mão por medição no
 * `semanticos.ts`: a derivação devolve `#1f2345` para o `nebula`. Chegar no mesmo
 * lugar por um critério explícito é o que dá confiança de que o critério é o
 * certo, e não um número que encaixou.
 */
const TINTA_DA_SELECAO = 1.25;

/**
 * O fundo de estado selecionado: o acento diluído na superfície base.
 *
 * Encontrado por busca, e não escolhido a dedo. A busca vai da **maior** para a
 * menor diluição e para na primeira que alcança a tinta: o resultado é o mais
 * sutil que ainda se nota.
 *
 * Uma primeira versão parava na primeira diluição que passava no contraste do
 * texto — e como a mais diluída passa com folga, ela devolvia um fundo
 * praticamente igual à superfície. O comentário afirmava "o mais colorido que
 * ainda passa", o contrário do que o código fazia; inverter a busca produzia o
 * extremo oposto, um bloco de cor saturado. Nenhum dos dois é um realce de linha.
 */
function fundoMudo(cor: string): string {
  const base = space.space800;

  for (let diluicao = 95; diluicao >= 0; diluicao -= 5) {
    const candidato = misturar(cor, base, diluicao / 100);

    const tinta = contraste(candidato, base);
    const texto = contraste(dust.dust000, candidato);

    if (tinta >= TINTA_DA_SELECAO && texto >= MINIMO_TEXTO) {
      return candidato;
    }
  }

  throw new Error(
    `Não foi possível derivar um fundo de seleção para "${cor}" que tenha tinta perceptível e mantenha o texto legível.`,
  );
}

/**
 * Mistura duas cores em sRGB, com `peso` indo de 0 (só `a`) a 1 (só `b`).
 *
 * sRGB e não OKLab: aqui a mistura só precisa ser monotônica, porque quem decide
 * se o resultado serve é a medição de contraste, não a aparência da curva. Para
 * **derivar** uma cor que precisa parecer certa — o que um seletor livre exigiria
 * — a conta tem de ser perceptual.
 */
export function misturar(a: string, b: string, peso: number): string {
  if (!Number.isFinite(peso) || peso < 0 || peso > 1) {
    throw new Error(`Peso de mistura inválido: ${peso}. Use de 0 a 1.`);
  }

  const canaisA = canais(a);
  const canaisB = canais(b);

  const juntos = canaisA.map((valor, i) =>
    Math.round(valor + ((canaisB[i] ?? 0) - valor) * peso),
  );

  return `#${juntos.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

function canais(cor: string): readonly number[] {
  const hex = cor.replace('#', '');
  const completo =
    hex.length === 3
      ? hex
          .split('')
          .map((c) => c + c)
          .join('')
      : hex;

  if (!/^[0-9a-f]{6}$/i.test(completo)) {
    throw new Error(`"${cor}" não é uma cor hexadecimal (#rgb ou #rrggbb).`);
  }

  return [
    Number.parseInt(completo.slice(0, 2), 16),
    Number.parseInt(completo.slice(2, 4), 16),
    Number.parseInt(completo.slice(4, 6), 16),
  ];
}

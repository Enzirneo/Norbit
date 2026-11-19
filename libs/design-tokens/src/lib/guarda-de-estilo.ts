/**
 * A guarda de estilo: cor literal e raio em pixel fora dos tokens.
 *
 * A camada de tokens só protege o que a usa. Basta uma tela escrever `#6d7cff`
 * ou `border-radius: 8px` para aquele pedaço ficar de fora de qualquer tema e de
 * qualquer escolha de cantos, e a quebra só aparece quando alguém troca o tema e
 * vê um canto da interface que não mudou. A guarda reprova isso na hora, no CI.
 *
 * Função pura sobre o texto de um arquivo, para ter teste sem tocar em disco: a
 * varredura de arquivos fica em `tools/verificar-estilo.ts`.
 *
 * Exceção: um comentário `estilo-literal: <motivo>` na mesma linha ou na linha de
 * cima libera **aquela linha**, e só ela. O motivo é obrigatório na prática (a
 * revisão o lê): é o registro de por que ali o token não serve.
 */

export type RegraDeEstilo = 'cor-literal' | 'raio-em-pixel';

export type Violacao = {
  readonly caminho: string;
  /** A partir de 1. */
  readonly linha: number;
  readonly regra: RegraDeEstilo;
  readonly trecho: string;
  readonly mensagem: string;
};

const MARCADOR_DE_EXCECAO = 'estilo-literal';

/**
 * Hexadecimal de 3 a 8 dígitos. O `\b` final e a exigência de só dígitos
 * hexadecimais deixam de fora `#grade` (referência de template do Angular) e
 * `&#64;` (entidade HTML, que tem só dois dígitos).
 */
const COR_HEXADECIMAL = /#[0-9a-fA-F]{3,8}\b/;

/**
 * Funções de cor. O `(?<![\w-])` evita `color-mix(`, que **é** o jeito certo de
 * misturar tokens, e o `\(` evita nomes soltos.
 */
const FUNCAO_DE_COR = /(?<![\w-])(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/;

/** `border-radius` e os de um canto só (`border-top-left-radius`...). */
const PROPRIEDADE_DE_RAIO = /\bborder(?:-[a-z]+){0,2}-radius\s*:/;

/** Um número com unidade absoluta ou de fonte: 8px, 0.5rem. `50%` é relativo. */
const MEDIDA_ABSOLUTA = /\d+(?:\.\d+)?(?:px|rem|em)\b/;

const EXTENSOES = /\.(?:scss|css|html|ts)$/;

/** Só o código do app web: os tokens moram em `libs/design-tokens`. */
export function deveVerificar(caminho: string): boolean {
  const c = caminho.replaceAll('\\', '/');

  return (
    c.startsWith('apps/web/src/') &&
    EXTENSOES.test(c) &&
    !c.endsWith('.spec.ts') &&
    !c.endsWith('tokens.generated.css')
  );
}

export function acharViolacoes(arquivo: {
  readonly caminho: string;
  readonly conteudo: string;
}): Violacao[] {
  const linhas = arquivo.conteudo.split('\n');
  const achadas: Violacao[] = [];

  linhas.forEach((texto, i) => {
    if (ehComentario(texto) || temExcecao(texto, linhas[i - 1])) {
      return;
    }

    const regra = regraViolada(texto);
    if (regra) {
      achadas.push({
        caminho: arquivo.caminho,
        linha: i + 1,
        regra,
        trecho: texto.trim(),
        mensagem: MENSAGENS[regra],
      });
    }
  });

  return achadas;
}

const MENSAGENS: Record<RegraDeEstilo, string> = {
  'cor-literal':
    'Cor literal. Use um token (`var(--accent)`, `var(--text-primary)`...) ou `color-mix` sobre tokens.',
  'raio-em-pixel':
    'Raio em medida fixa. Use um token de forma (`var(--raio-p)`, `var(--raio-m)`, `var(--raio-pilula)`...).',
};

function regraViolada(texto: string): RegraDeEstilo | null {
  if (COR_HEXADECIMAL.test(texto) || FUNCAO_DE_COR.test(texto)) {
    return 'cor-literal';
  }

  if (PROPRIEDADE_DE_RAIO.test(texto) && MEDIDA_ABSOLUTA.test(texto)) {
    return 'raio-em-pixel';
  }

  return null;
}

/** Linha de comentário: o que ela cita (uma cor antiga, um raio) não é uso. */
function ehComentario(texto: string): boolean {
  const t = texto.trimStart();
  return t.startsWith('//') || t.startsWith('/*') || t.startsWith('*');
}

function temExcecao(texto: string, anterior: string | undefined): boolean {
  return (
    texto.includes(MARCADOR_DE_EXCECAO) ||
    (anterior?.includes(MARCADOR_DE_EXCECAO) ?? false)
  );
}

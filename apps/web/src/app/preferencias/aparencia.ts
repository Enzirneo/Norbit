/**
 * A aparência: as preferências já resolvidas em valores de CSS, e o cache delas.
 *
 * Existe para que dois lugares apliquem **a mesma coisa**: o serviço, quando a
 * resposta da API chega, e o script do `index.html`, que roda antes de o Angular
 * existir. Sem o segundo, as preferências só valem depois do carregamento — e a
 * tela nasce com o acento padrão e troca de cor diante de quem olha.
 *
 * O script é **cego** de propósito: recebe um mapa genérico de propriedades e as
 * aplica sem saber o nome de nenhuma. A lista mora aqui e em lugar nenhum mais;
 * acrescentar uma propriedade não exige tocar no `index.html`.
 *
 * O cache guarda os **valores resolvidos**, e não as preferências. Guardar as
 * preferências obrigaria o script a repetir a derivação de cores — uma segunda
 * implementação de `derivar`, escrita à mão num HTML, onde ninguém a testa.
 */
import type { PreferenciasVisiveis } from '@norbit/contracts';
import {
  VARIAVEIS_SEMANTICAS,
  derivar,
  tokensDeForma,
  type TemaSemantico,
} from '@norbit/design-tokens';

/**
 * A chave do `localStorage`.
 *
 * A mesma string está escrita à mão no `index.html`: o script de lá roda antes
 * de qualquer módulo existir e não pode importá-la. O teste fixa o valor, para
 * que renomear aqui quebre aqui, e não só no navegador.
 */
export const CHAVE_DA_APARENCIA = 'norbit:aparencia';

/**
 * A unidade de espaçamento por densidade.
 *
 * A densidade multiplica a unidade base, e como todo espaçamento do projeto é
 * `calc(var(--space-unit) * n)`, mudar a unidade muda a tela inteira de uma vez.
 */
const UNIDADES = ['3px', '4px', '5px'] as const;

export type Aparencia = {
  readonly propriedades: Readonly<Record<string, string>>;
  readonly semMovimento: boolean;
};

export function aparenciaDe(preferencias: PreferenciasVisiveis): Aparencia {
  const { sementes, forma } = preferencias.tema;
  const { tokens, modo } = derivar(sementes);

  return {
    propriedades: {
      ...coresDe(tokens),
      ...tokensDeForma(forma),
      // Os controles nativos (rolagem, seletor de data) seguem o modo.
      'color-scheme': modo === 'claro' ? 'light' : 'dark',
      '--space-unit': UNIDADES[preferencias.density] ?? UNIDADES[1],
    },
    semMovimento: preferencias.reducedMotion,
  };
}

function coresDe(tokens: TemaSemantico): Record<string, string> {
  return Object.fromEntries(
    (Object.keys(VARIAVEIS_SEMANTICAS) as (keyof TemaSemantico)[]).map(
      (nome) => [VARIAVEIS_SEMANTICAS[nome], tokens[nome]],
    ),
  );
}

/**
 * Escreve a aparência na raiz do documento.
 *
 * Na raiz, e não num componente: o compilador do Angular 22 renomeia as custom
 * properties declaradas em estilo de componente, e o que precisa ser escrito são
 * exatamente os nomes que o `tokens.generated.css` declarou globalmente.
 *
 * `semMovimento` é um atributo, e não uma variável: a redução de movimento
 * desliga transições, e o CSS precisa de um seletor para isso. Ele **soma** à
 * consulta de mídia do sistema, sem substituí-la.
 */
export function aplicarAparencia(aparencia: Aparencia): void {
  const raiz = document.documentElement;

  for (const [nome, valor] of Object.entries(aparencia.propriedades)) {
    raiz.style.setProperty(nome, valor);
  }

  raiz.toggleAttribute('data-sem-movimento', aparencia.semMovimento);
}

export function guardarAparencia(aparencia: Aparencia): void {
  try {
    localStorage.setItem(CHAVE_DA_APARENCIA, JSON.stringify(aparencia));
  } catch {
    // Janela privada, dados bloqueados, cota cheia. O cache é uma otimização:
    // falhar ao guardá-lo não pode falhar a preferência, que já está no
    // servidor.
  }
}

export function lerAparenciaGuardada(): Aparencia | null {
  try {
    const bruto = localStorage.getItem(CHAVE_DA_APARENCIA);
    const lido: unknown = bruto === null ? null : JSON.parse(bruto);

    return ehAparencia(lido) ? lido : null;
  } catch {
    // O armazenamento é do navegador, e qualquer extensão mexe nele. Quebrar o
    // carregamento do app por conteúdo corrompido trocaria um flash de cor por
    // uma tela branca.
    return null;
  }
}

/**
 * Apaga o cache.
 *
 * Chamado no logout. Sem isso, a próxima pessoa a abrir o Norbit neste
 * navegador veria por um instante o tema da anterior — e a aparência é uma
 * informação sobre quem usava. Também tira da página o que já estava escrito:
 * a tela de entrada volta ao tema padrão na hora, sem esperar um recarregamento.
 */
export function esquecerAparencia(): void {
  // Antes de apagar o cache: é ele que diz **quais** propriedades a pessoa
  // escreveu na página.
  const guardada = lerAparenciaGuardada();
  if (guardada) {
    const raiz = document.documentElement;
    for (const nome of Object.keys(guardada.propriedades)) {
      raiz.style.removeProperty(nome);
    }
    raiz.removeAttribute('data-sem-movimento');
  }

  try {
    localStorage.removeItem(CHAVE_DA_APARENCIA);
  } catch {
    // Ver `guardarAparencia`.
  }
}

function ehAparencia(valor: unknown): valor is Aparencia {
  if (typeof valor !== 'object' || valor === null) {
    return false;
  }

  const { propriedades, semMovimento } = valor as Record<string, unknown>;

  return (
    typeof semMovimento === 'boolean' &&
    typeof propriedades === 'object' &&
    propriedades !== null &&
    Object.values(propriedades).every((v) => typeof v === 'string')
  );
}

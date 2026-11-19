/**
 * A aparência: as preferências já resolvidas em valores de CSS.
 *
 * Existe para que dois lugares apliquem **a mesma coisa**: o serviço, quando a
 * resposta da API chega, e o script do `index.html`, que roda antes de o Angular
 * existir. O script é cego de propósito — recebe um mapa genérico de
 * propriedades —, então a lista de nomes mora aqui e em lugar nenhum mais.
 */
import { TEMA_PADRAO, type Tema } from '@norbit/contracts';
import { ACENTOS, derivar } from '@norbit/design-tokens';
import {
  CHAVE_DA_APARENCIA,
  aparenciaDe,
  aplicarAparencia,
  esquecerAparencia,
  lerAparenciaGuardada,
  guardarAparencia,
} from './aparencia';

const PADRAO = {
  accentColor: ACENTOS.nebula,
  tema: TEMA_PADRAO,
  density: 1,
  reducedMotion: false,
  defaultView: 'WEEK' as const,
  weekStartsOn: 0,
  use24Hour: true,
};

describe('aparenciaDe', () => {
  it('escreve todos os tokens derivados das sementes do tema', () => {
    const { propriedades } = aparenciaDe(PADRAO);
    const { tokens } = derivar(TEMA_PADRAO.sementes);

    expect(propriedades['--surface-base']).toBe(tokens.surfaceBase);
    expect(propriedades['--text-primary']).toBe(tokens.textPrimary);
    expect(propriedades['--border-default']).toBe(tokens.borderDefault);
    expect(propriedades['--state-danger']).toBe(tokens.stateDanger);
    expect(propriedades['--accent']).toBe(ACENTOS.nebula);
    expect(propriedades['--accent-muted']).toBe(tokens.accentMuted);
  });

  it('o foco acompanha o destaque', () => {
    // Um anel de foco de outra cor pareceria de outro produto.
    expect(aparenciaDe(PADRAO).propriedades['--border-focus']).toBe(
      ACENTOS.nebula,
    );
  });

  it('um fundo claro escreve o esquema de cores claro, para os controles nativos', () => {
    const claro: Tema = {
      ...TEMA_PADRAO,
      sementes: { ...TEMA_PADRAO.sementes, fundo: '#f6f1ea' },
    };

    expect(aparenciaDe(PADRAO).propriedades['color-scheme']).toBe('dark');
    expect(
      aparenciaDe({ ...PADRAO, tema: claro }).propriedades['color-scheme'],
    ).toBe('light');
  });

  it('escreve a forma: os cantos e as estrelas', () => {
    const tema: Tema = {
      ...TEMA_PADRAO,
      forma: { ...TEMA_PADRAO.forma, cantos: 12, estrelas: false },
    };

    const { propriedades } = aparenciaDe({ ...PADRAO, tema });

    expect(propriedades['--r']).toBe('12px');
    expect(propriedades['--estrelas']).toBe('0');
  });

  it('o tema muda tudo junto: outro fundo, outras superfícies', () => {
    const outro: Tema = {
      ...TEMA_PADRAO,
      sementes: { ...TEMA_PADRAO.sementes, fundo: '#06141b' },
    };

    expect(
      aparenciaDe({ ...PADRAO, tema: outro }).propriedades['--surface-base'],
    ).toBe('#06141b');
  });

  it('a densidade escreve a unidade de espaçamento', () => {
    expect(
      aparenciaDe({ ...PADRAO, density: 0 }).propriedades['--space-unit'],
    ).toBe('3px');
    expect(
      aparenciaDe({ ...PADRAO, density: 1 }).propriedades['--space-unit'],
    ).toBe('4px');
    expect(
      aparenciaDe({ ...PADRAO, density: 2 }).propriedades['--space-unit'],
    ).toBe('5px');
  });

  it('uma densidade fora da escala cai na confortável, sem lançar', () => {
    // O valor vem do banco, e uma aparência quebrada no carregamento é pior
    // que uma aparência padrão.
    expect(
      aparenciaDe({ ...PADRAO, density: 9 }).propriedades['--space-unit'],
    ).toBe('4px');
  });

  it('carrega a redução de movimento', () => {
    expect(aparenciaDe(PADRAO).semMovimento).toBe(false);
    expect(aparenciaDe({ ...PADRAO, reducedMotion: true }).semMovimento).toBe(
      true,
    );
  });

  it('só devolve texto: é o que atravessa o JSON sem perda', () => {
    for (const valor of Object.values(aparenciaDe(PADRAO).propriedades)) {
      expect(typeof valor).toBe('string');
    }
  });
});

describe('o cache da aparência', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('guarda e lê de volta', () => {
    const aparencia = aparenciaDe({
      ...PADRAO,
      tema: {
        ...TEMA_PADRAO,
        sementes: { ...TEMA_PADRAO.sementes, destaque: ACENTOS.aurora },
      },
    });

    guardarAparencia(aparencia);

    expect(lerAparenciaGuardada()).toEqual(aparencia);
  });

  it('usa a chave que o script do index.html lê', () => {
    // A mesma string aparece no `index.html`, escrita à mão: o script roda
    // antes de qualquer módulo existir e não pode importá-la. Este teste fixa o
    // valor para que renomear aqui quebre aqui, e não só no navegador.
    expect(CHAVE_DA_APARENCIA).toBe('norbit:aparencia');

    guardarAparencia(aparenciaDe(PADRAO));
    expect(localStorage.getItem('norbit:aparencia')).not.toBeNull();
  });

  it('esquecer apaga', () => {
    guardarAparencia(aparenciaDe(PADRAO));

    esquecerAparencia();

    expect(lerAparenciaGuardada()).toBeNull();
  });

  it('esquecer também tira o tema da pessoa da página, e a tela volta ao padrão', () => {
    const claro: Tema = {
      ...TEMA_PADRAO,
      sementes: { ...TEMA_PADRAO.sementes, fundo: '#f6f1ea' },
    };
    const aparencia = aparenciaDe({ ...PADRAO, tema: claro });
    aplicarAparencia(aparencia);
    guardarAparencia(aparencia);
    const raiz = document.documentElement;
    expect(raiz.style.getPropertyValue('--surface-base')).not.toBe('');

    esquecerAparencia();

    // Quem entrar em seguida neste navegador não vê o tema de quem saiu.
    expect(raiz.style.getPropertyValue('--surface-base')).toBe('');
    expect(raiz.style.getPropertyValue('color-scheme')).toBe('');
  });

  it('um conteúdo corrompido vira "nada guardado", não um erro', () => {
    // O armazenamento é do navegador e qualquer extensão mexe nele. Quebrar o
    // carregamento do app por isso seria trocar um flash por uma tela branca.
    localStorage.setItem(CHAVE_DA_APARENCIA, '{não é json');

    expect(lerAparenciaGuardada()).toBeNull();
  });

  it('um conteúdo de formato errado também', () => {
    localStorage.setItem(CHAVE_DA_APARENCIA, JSON.stringify({ x: 1 }));

    expect(lerAparenciaGuardada()).toBeNull();
  });

  it('o armazenamento indisponível não derruba quem guarda', () => {
    // Janela privada, dados bloqueados: o acessor pode lançar. O cache é uma
    // otimização; falhar ao guardá-lo não pode falhar a preferência.
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error('bloqueado');
    };

    try {
      expect(() => guardarAparencia(aparenciaDe(PADRAO))).not.toThrow();
    } finally {
      Storage.prototype.setItem = original;
    }
  });
});

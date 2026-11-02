/**
 * A aparência: as preferências já resolvidas em valores de CSS.
 *
 * Existe para que dois lugares apliquem **a mesma coisa**: o serviço, quando a
 * resposta da API chega, e o script do `index.html`, que roda antes de o Angular
 * existir. O script é cego de propósito — recebe um mapa genérico de
 * propriedades —, então a lista de nomes mora aqui e em lugar nenhum mais.
 */
import { ACENTOS } from '@norbit/design-tokens';
import {
  CHAVE_DA_APARENCIA,
  aparenciaDe,
  esquecerAparencia,
  lerAparenciaGuardada,
  guardarAparencia,
} from './aparencia';

const PADRAO = {
  accentColor: ACENTOS.nebula,
  density: 1,
  reducedMotion: false,
  defaultView: 'WEEK' as const,
  weekStartsOn: 0,
  use24Hour: true,
};

describe('aparenciaDe', () => {
  it('escreve o acento e as cores que derivam dele', () => {
    const { propriedades } = aparenciaDe(PADRAO);

    expect(propriedades['--accent']).toBe(ACENTOS.nebula);
    expect(propriedades['--accent-hover']).toBeDefined();
    expect(propriedades['--accent-muted']).toBe('#1f2345');
    expect(propriedades['--text-on-accent']).toBeDefined();
  });

  it('o foco acompanha o acento', () => {
    // Um anel de foco de outra cor pareceria de outro produto.
    expect(aparenciaDe(PADRAO).propriedades['--border-focus']).toBe(
      ACENTOS.nebula,
    );
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
    const aparencia = aparenciaDe({ ...PADRAO, accentColor: ACENTOS.aurora });

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

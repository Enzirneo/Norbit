/**
 * O teste que impede o erro de contraste de voltar.
 *
 * O `docs/04` promete "contraste mínimo 4.5:1 em texto, 3:1 em elementos
 * gráficos, verificado nos quatro presets". Promessa em documento não verifica
 * nada — isto verifica, e reprova a build.
 */
import { MINIMO_GRAFICO, MINIMO_TEXTO, contraste } from './contraste';
import { NOMES_SEMANTICOS, presets, type TemaSemantico } from './semanticos';

/**
 * Os pares que precisam de contraste, declarados um por um.
 *
 * Testar todas as combinações possíveis acusaria falhas em pares que nunca
 * aparecem juntos na tela — ruído que levaria a relaxar o limite.
 */
const PARES_DE_TEXTO: readonly [keyof TemaSemantico, keyof TemaSemantico][] = [
  ['textPrimary', 'surfaceBase'],
  ['textPrimary', 'surfaceRaised'],
  ['textPrimary', 'surfaceOverlay'],
  ['textPrimary', 'surfaceSunken'],
  ['textSecondary', 'surfaceBase'],
  ['textSecondary', 'surfaceRaised'],
  ['textMuted', 'surfaceBase'],
  ['textMuted', 'surfaceRaised'],
  ['textOnAccent', 'accent'],
  ['textOnAccent', 'accentHover'],
  ['accent', 'surfaceBase'],
  ['accent', 'surfaceRaised'],
  ['stateSuccess', 'surfaceBase'],
  ['stateWarning', 'surfaceBase'],
  ['stateDanger', 'surfaceBase'],
];

/** Contorno de componente e indicador de foco: o mínimo é 3:1. */
const PARES_GRAFICOS: readonly [keyof TemaSemantico, keyof TemaSemantico][] = [
  ['borderDefault', 'surfaceBase'],
  ['borderDefault', 'surfaceRaised'],
  ['borderFocus', 'surfaceBase'],
  ['borderFocus', 'surfaceRaised'],
];

describe('presets semânticos', () => {
  const nomes = Object.keys(presets) as (keyof typeof presets)[];

  it('define pelo menos o preset padrão', () => {
    expect(nomes).toContain('nebula');
  });

  describe.each(nomes)('%s', (nome) => {
    const tema = presets[nome];

    it('declara todos os tokens semânticos', () => {
      // Um token faltando não quebra nada visivelmente: a variável CSS fica
      // indefinida e o elemento herda uma cor qualquer. É o tipo de falha que
      // só aparece quando alguém troca de tema meses depois.
      for (const token of NOMES_SEMANTICOS) {
        expect(tema[token], `${nome}.${token}`).toBeTruthy();
      }
    });

    it.each(PARES_DE_TEXTO)(
      'tem contraste de texto suficiente: %s sobre %s',
      (frente, fundo) => {
        const razao = contraste(tema[frente], tema[fundo]);

        expect(
          razao,
          `${nome}: ${frente} sobre ${fundo} = ${razao.toFixed(2)}:1`,
        ).toBeGreaterThanOrEqual(MINIMO_TEXTO);
      },
    );

    it.each(PARES_GRAFICOS)(
      'tem contraste gráfico suficiente: %s sobre %s',
      (frente, fundo) => {
        const razao = contraste(tema[frente], tema[fundo]);

        expect(
          razao,
          `${nome}: ${frente} sobre ${fundo} = ${razao.toFixed(2)}:1`,
        ).toBeGreaterThanOrEqual(MINIMO_GRAFICO);
      },
    );
  });
});

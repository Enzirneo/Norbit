import { MINIMO_GRAFICO, MINIMO_TEXTO, contraste } from './contraste';
import { derivar } from './derivar';
import { NOMES_SEMANTICOS, type TemaSemantico } from './semanticos';
import type { Sementes } from './sementes';
import { TEMAS_PRONTOS } from './temas-prontos';

type Par = readonly [keyof TemaSemantico, keyof TemaSemantico];

/** Os mesmos pares que o teste dos presets exige. */
const PARES_DE_TEXTO: readonly Par[] = [
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

const PARES_GRAFICOS: readonly Par[] = [
  ['borderDefault', 'surfaceBase'],
  ['borderDefault', 'surfaceRaised'],
  ['borderFocus', 'surfaceBase'],
  ['borderFocus', 'surfaceRaised'],
];

function razao(tema: TemaSemantico, [frente, fundo]: Par): number {
  return contraste(tema[frente], tema[fundo]);
}

/** O que reprova, em texto, para a mensagem do teste dizer o que falhou. */
function falhas(tema: TemaSemantico, alvoDoPrincipal: number): string[] {
  const reprovados = [
    ...PARES_DE_TEXTO.filter((p) => razao(tema, p) < MINIMO_TEXTO),
    ...PARES_GRAFICOS.filter((p) => razao(tema, p) < MINIMO_GRAFICO),
  ].map((p) => `${p[0]}/${p[1]}=${razao(tema, p).toFixed(2)}`);

  const principal = razao(tema, ['textPrimary', 'surfaceBase']);
  return principal < alvoDoPrincipal
    ? [...reprovados, `textPrimary=${principal.toFixed(2)}<${alvoDoPrincipal}`]
    : reprovados;
}

const FUNDOS = [
  '#000000',
  '#0b0d17',
  '#1a1a1a',
  '#2a3a55',
  '#555555',
  '#808080',
  '#a0a0a0',
  '#c8c8d0',
  '#f6f1ea',
  '#ffffff',
  '#ff0000',
  '#00ff88',
];

const DESTAQUES = [
  '#000000',
  '#6d7cff',
  '#4adebb',
  '#ffb357',
  '#ff6b8a',
  '#a97bff',
  '#ffffff',
  '#808080',
  '#ff0000',
  '#0000ff',
  '#ffff00',
  '#0b0d17',
];

const PADRAO: Sementes = {
  fundo: '#0b0d17',
  destaque: '#6d7cff',
  contraste: 'normal',
};

function claridade(hex: string): number {
  return Number.parseInt(hex.slice(1, 3), 16);
}

describe('derivar', () => {
  describe('o tema padrão', () => {
    const { tokens, avisos } = derivar(PADRAO);

    it('mantém o fundo e o destaque exatamente como foram escolhidos', () => {
      expect(tokens.surfaceBase).toBe('#0b0d17');
      expect(tokens.accent).toBe('#6d7cff');
    });

    it('não tem nada a avisar', () => {
      expect(avisos).toEqual([]);
    });

    it('declara todos os tokens semânticos, em hexadecimal', () => {
      for (const nome of NOMES_SEMANTICOS) {
        expect(tokens[nome], nome).toMatch(/^#[0-9a-f]{6}$/);
      }
    });

    it('as superfícies sobem em degraus, do rebaixado ao sobreposto', () => {
      expect(claridade(tokens.surfaceSunken)).toBeLessThan(
        claridade(tokens.surfaceBase),
      );
      expect(claridade(tokens.surfaceBase)).toBeLessThan(
        claridade(tokens.surfaceRaised),
      );
      expect(claridade(tokens.surfaceRaised)).toBeLessThan(
        claridade(tokens.surfaceOverlay),
      );
    });
  });

  describe('modo', () => {
    it('um fundo claro dá modo claro e texto mais escuro que o fundo', () => {
      const { tokens, modo } = derivar({
        fundo: '#f6f1ea',
        destaque: '#5b4bd6',
        contraste: 'normal',
      });

      expect(modo).toBe('claro');
      expect(claridade(tokens.textPrimary)).toBeLessThan(
        claridade(tokens.surfaceBase),
      );
    });

    it('um fundo escuro dá modo escuro e texto mais claro que o fundo', () => {
      const { tokens, modo } = derivar(PADRAO);

      expect(modo).toBe('escuro');
      expect(claridade(tokens.textPrimary)).toBeGreaterThan(
        claridade(tokens.surfaceBase),
      );
    });
  });

  describe('contraste alto', () => {
    it('leva o texto principal a pelo menos 10:1, em qualquer superfície', () => {
      const { tokens } = derivar({ ...PADRAO, contraste: 'alto' });

      expect(
        contraste(tokens.textPrimary, tokens.surfaceBase),
      ).toBeGreaterThanOrEqual(10);
      expect(
        contraste(tokens.textPrimary, tokens.surfaceOverlay),
      ).toBeGreaterThanOrEqual(10);
    });

    it('deixa o texto de apoio mais forte que no contraste normal', () => {
      const normal = derivar(PADRAO).tokens;
      const alto = derivar({ ...PADRAO, contraste: 'alto' }).tokens;

      expect(contraste(alto.textMuted, alto.surfaceBase)).toBeGreaterThan(
        contraste(normal.textMuted, normal.surfaceBase),
      );
    });
  });

  describe('nunca recusa uma semente', () => {
    it('um destaque igual ao fundo é ajustado, e a pessoa é avisada', () => {
      const { tokens, avisos } = derivar({
        fundo: '#6d7cff',
        destaque: '#6d7cff',
        contraste: 'normal',
      });

      expect(avisos.length).toBeGreaterThan(0);
      expect(
        contraste(tokens.accent, tokens.surfaceBase),
      ).toBeGreaterThanOrEqual(MINIMO_TEXTO);
    });

    it('um fundo de claridade média é ajustado até o texto caber', () => {
      const { avisos } = derivar({ ...PADRAO, fundo: '#808080' });

      expect(avisos.join(' ')).toMatch(/fundo/);
    });

    it('as mensagens são para gente: em português e explicando o que mudou', () => {
      const { avisos } = derivar({
        fundo: '#808080',
        destaque: '#808080',
        contraste: 'alto',
      });

      expect(avisos.length).toBeGreaterThan(0);
      for (const aviso of avisos) {
        expect(aviso).toMatch(/^Ajustamos/);
      }
    });

    it('um destaque que já é legível não é tocado nem avisado', () => {
      const { tokens, avisos } = derivar({ ...PADRAO, destaque: '#ffb357' });

      expect(tokens.accent).toBe('#ffb357');
      expect(avisos).toEqual([]);
    });
  });

  it('é determinística', () => {
    const sementes: Sementes = {
      fundo: '#2a3a55',
      destaque: '#ffb357',
      contraste: 'normal',
    };

    expect(derivar(sementes)).toEqual(derivar(sementes));
  });

  it('aceita hexadecimal em maiúsculas', () => {
    const a = derivar({ ...PADRAO, fundo: '#0B0D17', destaque: '#6D7CFF' });

    expect(a).toEqual(derivar(PADRAO));
  });

  describe('destaque derivado', () => {
    it.each(Object.entries(TEMAS_PRONTOS))(
      '%s: o hover se distingue do destaque e o texto continua legível nele',
      (_nome, sementes) => {
        const { tokens } = derivar(sementes);

        expect(
          contraste(tokens.accentHover, tokens.accent),
        ).toBeGreaterThanOrEqual(1.15);
        expect(tokens.accentHover).not.toBe(tokens.accent);
      },
    );

    it.each(Object.entries(TEMAS_PRONTOS))(
      '%s: o hover se afasta da frente, então o texto ganha contraste em vez de perder',
      (_nome, sementes) => {
        const { tokens } = derivar(sementes);

        expect(
          contraste(tokens.textOnAccent, tokens.accentHover),
        ).toBeGreaterThanOrEqual(contraste(tokens.textOnAccent, tokens.accent));
      },
    );

    it.each(Object.entries(TEMAS_PRONTOS))(
      '%s: o fundo de seleção tem tinta perceptível e o texto passa em cima',
      (_nome, sementes) => {
        const { tokens } = derivar(sementes);

        expect(
          contraste(tokens.accentMuted, tokens.surfaceBase),
        ).toBeGreaterThanOrEqual(1.25);
        expect(
          contraste(tokens.textPrimary, tokens.accentMuted),
        ).toBeGreaterThanOrEqual(MINIMO_TEXTO);
      },
    );

    it.each(Object.entries(TEMAS_PRONTOS))(
      '%s: a borda suave é mais fraca que a de componente, e as duas se veem',
      (_nome, sementes) => {
        const { tokens } = derivar(sementes);
        const suave = contraste(tokens.borderSubtle, tokens.surfaceBase);
        const padrao = contraste(tokens.borderDefault, tokens.surfaceBase);

        expect(suave).toBeGreaterThan(1);
        expect(suave).toBeLessThan(padrao);
      },
    );
  });

  describe('os estados', () => {
    it('sucesso, aviso e perigo são matizes distintos', () => {
      const { tokens } = derivar(PADRAO);

      expect(
        new Set([tokens.stateSuccess, tokens.stateWarning, tokens.stateDanger])
          .size,
      ).toBe(3);
    });
  });

  describe('os temas prontos', () => {
    it.each(Object.entries(TEMAS_PRONTOS))(
      '%s passa em todos os contrastes, sem aviso',
      (_nome, sementes) => {
        const { tokens, avisos } = derivar(sementes);

        expect(falhas(tokens, 7)).toEqual([]);
        expect(avisos).toEqual([]);
      },
    );
  });

  describe('varredura: nenhuma combinação reprova', () => {
    const combinacoes = FUNDOS.flatMap((fundo) =>
      DESTAQUES.flatMap((destaque) =>
        (['normal', 'alto'] as const).map((contrasteDe) => ({
          fundo,
          destaque,
          contraste: contrasteDe,
        })),
      ),
    );

    it('os pares de contraste valem para qualquer fundo e destaque', () => {
      const reprovadas = combinacoes.flatMap((sementes) => {
        const { tokens } = derivar(sementes);
        const alvo = sementes.contraste === 'alto' ? 10 : 7;

        return falhas(tokens, alvo).map(
          (f) =>
            `${sementes.fundo}+${sementes.destaque}+${sementes.contraste}: ${f}`,
        );
      });

      expect(reprovadas).toEqual([]);
    });
  });
});

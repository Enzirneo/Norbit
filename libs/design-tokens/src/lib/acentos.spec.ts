/**
 * O teste que impede um acento ilegível de ser oferecido.
 *
 * O `semanticos.spec.ts` verifica os pares do preset. Este verifica a outra
 * metade da promessa do `docs/04`: que a cor de destaque **escolhida pela
 * pessoa** continue passando no contraste — inclusive as cores derivadas dela.
 */
import {
  ACENTOS,
  VALORES_DE_ACENTO,
  derivarAcento,
  melhorFrente,
  misturar,
  type NomeDeAcento,
} from './acentos';
import {
  MINIMO_GRAFICO,
  MINIMO_TEXTO,
  contraste,
  luminancia,
} from './contraste';
import { dust, space } from './primitives';

const NOMES = Object.keys(ACENTOS) as NomeDeAcento[];

describe('cada acento oferecido passa no contraste', () => {
  describe.each(NOMES)('%s', (nome) => {
    const cor = ACENTOS[nome];
    const derivado = derivarAcento(cor);

    it('a frente escolhida passa no mínimo de texto', () => {
      expect(
        contraste(derivado.textOnAccent, derivado.accent),
      ).toBeGreaterThanOrEqual(MINIMO_TEXTO);
    });

    it('a mesma frente continua passando no hover', () => {
      // O hover afasta o acento, e afastar mexe no contraste com a frente. Se
      // ele for longe demais, o texto do botão reprova **só no hover** — um
      // defeito que nenhuma inspeção estática encontra.
      expect(
        contraste(derivado.textOnAccent, derivado.accentHover),
      ).toBeGreaterThanOrEqual(MINIMO_TEXTO);
    });

    it('o acento se distingue das superfícies como elemento gráfico', () => {
      // Ele é usado como anel de foco e como preenchimento de botão: 3:1.
      for (const superficie of [space.space800, space.space700]) {
        expect(contraste(cor, superficie)).toBeGreaterThanOrEqual(
          MINIMO_GRAFICO,
        );
      }
    });

    it('o texto primário passa sobre o fundo de seleção', () => {
      expect(
        contraste(dust.dust000, derivado.accentMuted),
      ).toBeGreaterThanOrEqual(MINIMO_TEXTO);
    });

    it('o fundo de seleção tem tinta perceptível e continua sendo fundo', () => {
      // O critério que define o token, e que o contraste do texto sozinho não
      // captura: medido, uma diluição de 95% passa no texto com 13:1 e é
      // indistinguível da superfície.
      const tinta = contraste(derivado.accentMuted, space.space800);

      expect(tinta).toBeGreaterThanOrEqual(1.2);
      expect(tinta).toBeLessThan(1.6);
    });

    it('o hover é perceptivelmente diferente do acento', () => {
      // Medido: clarear 12% dava 1.046:1 no `aurora` — uma mudança que ninguém
      // vê. A derivação busca a distância em vez de aplicar porcentagem fixa.
      expect(derivado.accentHover).not.toBe(derivado.accent);
      expect(
        contraste(derivado.accentHover, derivado.accent),
      ).toBeGreaterThanOrEqual(1.15);
    });
  });
});

describe('melhorFrente', () => {
  it('escolhe a frente escura para acentos claros', () => {
    // O resultado que contraria o instinto, e que o `semanticos.ts` registrou:
    // botão de acento leva letra escura.
    expect(melhorFrente(ACENTOS.nebula)).toBe(space.space900);
    expect(melhorFrente(ACENTOS.aurora)).toBe(space.space900);
  });

  it('escolhe a frente clara para um acento escuro', () => {
    expect(melhorFrente('#1a1a2e')).toBe(dust.dust000);
  });

  it('recusa um tom médio em que nenhuma das duas frentes alcança o AA', () => {
    // Não é hipótese remota, e a faixa foi **medida**: `#74747e` dá 4.32:1 com
    // o quase preto e 4.25:1 com o quase branco. Um botão desses é ilegível
    // para quem precisa do mínimo e parece aceitável para quem não precisa — o
    // pior tipo de defeito de acessibilidade.
    expect(() => melhorFrente('#74747e')).toThrow(/contraste/i);
  });

  it('a mensagem diz qual foi o melhor caso', () => {
    // Para quem lê o erro saber se faltou pouco ou muito.
    expect(() => melhorFrente('#74747e')).toThrow(/\d\.\d\d:1/);
  });
});

describe('derivarAcento', () => {
  it('o fundo de seleção é derivado, não fixo', () => {
    // O valor antigo era `#1F2547`, escolhido à mão para um acento. Dois
    // acentos diferentes têm de produzir fundos diferentes.
    expect(derivarAcento(ACENTOS.nebula).accentMuted).not.toBe(
      derivarAcento(ACENTOS.solar).accentMuted,
    );
  });

  it('o fundo de seleção fica mais perto da superfície que do acento', () => {
    // Ele é um realce de fundo, não um bloco de cor: tem de passar contraste
    // com o texto primário em cima, e isso exige diluição.
    const { accentMuted } = derivarAcento(ACENTOS.nebula);

    expect(contraste(accentMuted, space.space800)).toBeLessThan(
      contraste(ACENTOS.nebula, space.space800),
    );
  });

  it('reproduz, para o nebula, o valor que havia sido medido à mão', () => {
    // `#1F2547` foi escolhido à mão em `semanticos.ts`, por medição, para este
    // acento. A derivação chega em `#1f2345` — praticamente o mesmo lugar, por
    // um critério explícito. É a evidência de que o critério está certo, e não
    // um número que encaixou.
    expect(derivarAcento(ACENTOS.nebula).accentMuted).toBe('#1f2345');
  });

  it('um acento já claro tem o hover mais escuro, não mais claro', () => {
    // Clarear um acento claro não se vê, e levá-lo longe o suficiente para se
    // ver o deixaria quase branco — sem cor nenhuma. O `aurora` tem luminância
    // 0.573; o hover dele desce.
    const { accent: cor, accentHover } = derivarAcento(ACENTOS.aurora);

    expect(luminancia(accentHover)).toBeLessThan(luminancia(cor));
  });

  it('um acento escuro tem o hover mais claro', () => {
    const { accent: cor, accentHover } = derivarAcento(ACENTOS.nebula);

    expect(luminancia(accentHover)).toBeGreaterThan(luminancia(cor));
  });

  it('recusa uma cor que não é hexadecimal', () => {
    expect(() => derivarAcento('rebeccapurple')).toThrow(/hexadecimal/i);
  });
});

describe('a lista de valores', () => {
  it('acompanha a paleta, sem segunda fonte de verdade', () => {
    // `VALORES_DE_ACENTO` é o que o contrato usa para validar a escolha. Se ele
    // fosse uma lista escrita à mão, acrescentar um acento aqui deixaria o
    // contrato recusando a cor nova.
    expect([...VALORES_DE_ACENTO].sort()).toEqual(
      Object.values(ACENTOS).slice().sort(),
    );
  });

  it('são cinco', () => {
    expect(VALORES_DE_ACENTO).toHaveLength(5);
  });
});

describe('misturar', () => {
  it('peso 0 devolve a primeira cor', () => {
    expect(misturar('#000000', '#ffffff', 0)).toBe('#000000');
  });

  it('peso 1 devolve a segunda', () => {
    expect(misturar('#000000', '#ffffff', 1)).toBe('#ffffff');
  });

  it('o meio fica no meio', () => {
    expect(misturar('#000000', '#ffffff', 0.5)).toBe('#808080');
  });

  it('zera à esquerda cada canal', () => {
    // Sem o `padStart`, um canal abaixo de 16 produz `#f0f` de cinco dígitos —
    // uma cor inválida que o CSS ignora em silêncio.
    expect(misturar('#000000', '#0f0f0f', 1)).toBe('#0f0f0f');
  });

  it('recusa peso fora de 0 a 1', () => {
    expect(() => misturar('#000000', '#ffffff', 1.5)).toThrow(/peso/i);
    expect(() => misturar('#000000', '#ffffff', -0.1)).toThrow(/peso/i);
  });
});

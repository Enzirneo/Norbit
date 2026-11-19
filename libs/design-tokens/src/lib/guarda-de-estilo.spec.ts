import {
  acharViolacoes,
  deveVerificar,
  type Violacao,
} from './guarda-de-estilo';

function achar(
  conteudo: string,
  caminho = 'apps/web/src/app/x/x.scss',
): Violacao[] {
  return acharViolacoes({ caminho, conteudo });
}

describe('acharViolacoes — cor literal', () => {
  it.each(['#fff', '#6d7cff', '#6d7cff80', '#ABCDEF'])(
    'acusa a cor hexadecimal %s',
    (hex) => {
      const achadas = achar(`.a { color: ${hex}; }`);

      expect(achadas).toHaveLength(1);
      expect(achadas[0].regra).toBe('cor-literal');
    },
  );

  it.each([
    'rgb(0 0 0)',
    'rgba(0, 0, 0, .5)',
    'hsl(200 50% 50%)',
    'oklch(0.7 0.1 250)',
  ])('acusa a função de cor %s', (cor) => {
    expect(achar(`.a { background: ${cor}; }`)).toHaveLength(1);
  });

  it('acusa a cor dentro de uma string de TypeScript', () => {
    const achadas = achar("const c = '#6d7cff';", 'apps/web/src/app/x/x.ts');

    expect(achadas).toHaveLength(1);
  });

  it('não confunde com o que não é cor', () => {
    expect(achar('.a { color: var(--accent); }')).toEqual([]);
    expect(
      achar(
        '.a { background: color-mix(in oklab, var(--accent) 20%, transparent); }',
      ),
    ).toEqual([]);
    // Referência de template do Angular e entidade HTML.
    expect(
      achar('<div #grade class="g"></div>', 'apps/web/src/app/x/x.html'),
    ).toEqual([]);
    expect(
      achar('<span>&#64;{{ handle }}</span>', 'apps/web/src/app/x/x.html'),
    ).toEqual([]);
    expect(achar('.a { content: "#"; }')).toEqual([]);
  });
});

describe('acharViolacoes — raio em pixel', () => {
  it.each(['8px', '999px', '9999px', '0.5rem', '12px 4px'])(
    'acusa border-radius com %s',
    (valor) => {
      const achadas = achar(`.a { border-radius: ${valor}; }`);

      expect(achadas).toHaveLength(1);
      expect(achadas[0].regra).toBe('raio-em-pixel');
    },
  );

  it('acusa os raios de um canto só', () => {
    expect(achar('.a { border-top-left-radius: 6px; }')).toHaveLength(1);
  });

  it('aceita o que é token, relativo ou zero', () => {
    expect(achar('.a { border-radius: var(--raio-p); }')).toEqual([]);
    expect(achar('.a { border-radius: calc(var(--space-unit) * 2); }')).toEqual(
      [],
    );
    expect(achar('.a { border-radius: 50%; }')).toEqual([]);
    expect(achar('.a { border-radius: 0; }')).toEqual([]);
  });

  it('só olha raio: outras propriedades em pixel são do layout', () => {
    expect(achar('.a { width: 8px; padding: 4px; }')).toEqual([]);
  });
});

describe('acharViolacoes — exceções e ruído', () => {
  it('uma exceção declarada na mesma linha é aceita', () => {
    expect(
      achar(
        '.a { background: rgb(0 0 0 / 0.5); } /* estilo-literal: motivo */',
      ),
    ).toEqual([]);
  });

  it('uma exceção declarada na linha de cima é aceita', () => {
    expect(
      achar(
        '/* estilo-literal: ::backdrop não herda as variáveis */\n.a { background: rgb(0 0 0 / 0.5); }',
      ),
    ).toEqual([]);
  });

  it('a exceção vale só para a linha seguinte, e não para o arquivo todo', () => {
    const achadas = achar(
      '/* estilo-literal: motivo */\n.a { color: #fff; }\n.b { color: #000; }',
    );

    expect(achadas).toHaveLength(1);
    expect(achadas[0].linha).toBe(3);
  });

  it('ignora o que está em comentário', () => {
    expect(achar('/* a cor era #6d7cff */')).toEqual([]);
    expect(achar(' * o raio de 8px não vale mais')).toEqual([]);
    expect(achar('// border-radius: 8px', 'apps/web/src/app/x/x.ts')).toEqual(
      [],
    );
  });

  it('informa a linha (a partir de 1), o arquivo e o trecho', () => {
    const [v] = achar(
      '.ok { color: var(--accent); }\n\n.ruim { color: #6d7cff; }',
    );

    expect(v.linha).toBe(3);
    expect(v.caminho).toBe('apps/web/src/app/x/x.scss');
    expect(v.trecho).toContain('#6d7cff');
    expect(v.mensagem).toMatch(/token/i);
  });

  it('acusa todas as violações do arquivo, na ordem', () => {
    const achadas = achar('.a { color: #fff; }\n.b { border-radius: 8px; }');

    expect(achadas.map((v) => [v.linha, v.regra])).toEqual([
      [1, 'cor-literal'],
      [2, 'raio-em-pixel'],
    ]);
  });
});

describe('deveVerificar', () => {
  it.each([
    'apps/web/src/app/ui/botao.scss',
    'apps/web/src/app/ui/botao.ts',
    'apps/web/src/app/calendario/calendario.html',
    'apps/web/src/styles.scss',
  ])('verifica %s', (caminho) => {
    expect(deveVerificar(caminho)).toBe(true);
  });

  it.each([
    'apps/web/src/tokens.generated.css',
    'apps/web/src/app/ui/botao.spec.ts',
    'libs/design-tokens/src/lib/primitives.ts',
    'apps/api/src/app/auth/auth.service.ts',
    'apps/web/src/assets/logo.svg',
  ])('não verifica %s', (caminho) => {
    expect(deveVerificar(caminho)).toBe(false);
  });

  it('aceita o separador do Windows', () => {
    expect(deveVerificar('apps\\web\\src\\app\\ui\\botao.scss')).toBe(true);
  });
});

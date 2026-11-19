/**
 * A aparência que o navegador realmente aplica.
 *
 * Os testes de componente não enxergam CSS, e foi por isso que dois defeitos
 * passaram por dezenas de PRs com tudo verde: os botões nunca receberam estilo
 * (o seletor de classe não casava com o elemento hospedeiro) e o diálogo abria
 * colado no canto da tela (o reset do Tailwind zera a margem automática do
 * `<dialog>`). Aqui se mede o resultado calculado, que é o que a pessoa vê.
 */
import { test, expect, type Locator, type Page } from '@playwright/test';
import { entrar, restaurarBanco } from './apoio';

const TRANSPARENTE = ['rgba(0, 0, 0, 0)', 'transparent'];

type Caixa = { x: number; y: number; width: number; height: number };

/** A caixa de um elemento, já conferida: sem `?? 0` espalhado pelos testes. */
async function caixaDe(alvo: Locator): Promise<Caixa> {
  const caixa = await alvo.boundingBox();
  expect(caixa, 'O elemento não está na tela.').not.toBeNull();
  return caixa ?? { x: 0, y: 0, width: 0, height: 0 };
}

async function abrirNovoEvento(page: Page): Promise<void> {
  await entrar(page);
  await page.getByRole('radio', { name: 'Dia' }).click();
  await page.getByRole('button', { name: /^Criar evento às 9h/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

test.describe('aparência', () => {
  test.beforeEach(() => {
    restaurarBanco();
  });

  test('o botão sólido tem o fundo de acento, e não o transparente', async ({
    page,
  }) => {
    await page.goto('/entrar');

    const fundo = await page
      .getByRole('button', { name: 'Entrar' })
      .evaluate((el) => getComputedStyle(el).backgroundColor);

    expect(TRANSPARENTE).not.toContain(fundo);
  });

  test('o botão sólido tem cantos arredondados e respiro interno', async ({
    page,
  }) => {
    await page.goto('/entrar');

    const estilo = await page
      .getByRole('button', { name: 'Entrar' })
      .evaluate((el) => {
        const s = getComputedStyle(el);
        return {
          raio: parseFloat(s.borderTopLeftRadius),
          respiro: parseFloat(s.paddingTop),
        };
      });

    expect(estilo.raio).toBeGreaterThan(0);
    expect(estilo.respiro).toBeGreaterThan(4);
  });

  test('o diálogo abre no centro da tela, e não colado no canto', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await abrirNovoEvento(page);

    const c = await caixaDe(page.getByRole('dialog'));

    // O centro horizontal do diálogo é o centro da janela, com folga de 2px.
    expect(Math.abs(c.x + c.width / 2 - 1280 / 2)).toBeLessThan(2);
    // E ele não encosta no topo nem na esquerda.
    expect(c.x).toBeGreaterThan(100);
    expect(c.y).toBeGreaterThan(8);
  });

  test('o formulário do evento não tem rolagem horizontal', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await abrirNovoEvento(page);

    const transborda = await page
      .getByRole('dialog')
      .evaluate((el) => el.scrollWidth > el.clientWidth);

    expect(transborda).toBe(false);
  });

  test('no celular, o diálogo cabe na largura da tela', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await abrirNovoEvento(page);

    const caixa = await caixaDe(page.getByRole('dialog'));
    const transborda = await page
      .getByRole('dialog')
      .evaluate((el) => el.scrollWidth > el.clientWidth);

    expect(caixa.x).toBeGreaterThanOrEqual(0);
    expect(caixa.x + caixa.width).toBeLessThanOrEqual(390);
    expect(transborda).toBe(false);
  });
});

test.describe('casca do app', () => {
  test.beforeEach(async ({ page }) => {
    restaurarBanco();
    await page.setViewportSize({ width: 1280, height: 800 });
    await entrar(page);
  });

  test('o nome de cada agenda aparece inteiro na barra lateral', async ({
    page,
  }) => {
    // O botão de compartilhar comia a largura da linha e o nome virava "M…".
    // Cada nome precisa ter largura para pelo menos "Minha agenda" (o nome da
    // agenda padrão de quem se cadastra pela tela), e não só caber em si mesmo:
    // os nomes curtos do seed passavam mesmo com a linha apertada.
    const larguras = await page
      .locator('.agenda-nome')
      .evaluateAll((nomes) => nomes.map((n) => n.clientWidth));
    for (const largura of larguras) {
      expect(largura).toBeGreaterThanOrEqual(90);
    }

    const cortados = await page
      .locator('.agenda-nome')
      .evaluateAll((nomes) =>
        nomes
          .filter((n) => n.scrollWidth > n.clientWidth)
          .map((n) => n.textContent),
      );

    expect(cortados).toEqual([]);
  });

  test('Perfil e Preferências ficam juntos, no pé da barra lateral', async ({
    page,
  }) => {
    // Cada link tinha `margin-top: auto`, e o espaço livre se dividia entre os
    // dois: um flutuava no meio da barra e o outro ficava no rodapé.
    const perfil = await caixaDe(page.getByRole('link', { name: 'Perfil' }));
    const prefs = await caixaDe(
      page.getByRole('link', { name: 'Preferências' }),
    );
    const barra = await caixaDe(page.locator('.lateral'));

    expect(prefs.y - (perfil.y + perfil.height)).toBeLessThan(16);
    expect(barra.y + barra.height - (prefs.y + prefs.height)).toBeLessThan(40);
  });

  test('o cabeçalho cabe numa linha, sem nada por cima de nada', async ({
    page,
  }) => {
    const blocos = [
      await caixaDe(page.locator('.topo nb-marca')),
      await caixaDe(page.locator('.navegacao')),
      await caixaDe(page.locator('.visoes')),
      await caixaDe(page.locator('.conta')),
    ];

    // Na mesma linha: o topo do mais baixo está dentro da altura do mais alto.
    const topos = blocos.map((b) => b.y);
    const altura = Math.max(...blocos.map((b) => b.height));
    expect(Math.max(...topos) - Math.min(...topos)).toBeLessThan(altura);

    // Em ordem, sem se sobrepor.
    for (let i = 1; i < blocos.length; i += 1) {
      expect(blocos[i].x).toBeGreaterThanOrEqual(
        blocos[i - 1].x + blocos[i - 1].width,
      );
    }
  });

  test('no celular a página não rola na horizontal', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto('/');
    await expect(page.getByRole('radiogroup')).toBeVisible();

    const transborda = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );

    expect(transborda).toBe(false);
  });
});

test.describe('calendário', () => {
  test.beforeEach(async ({ page }) => {
    restaurarBanco();
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test('a semana abre rolada até a hora atual, e não às 0h', async ({
    page,
  }) => {
    // 15h30 em São Paulo. Sem fixar o relógio o teste dependeria da hora em que
    // roda: à 0h30 "perto da hora atual" é o topo da grade.
    await page.clock.setFixedTime(new Date('2026-11-18T18:30:00.000Z'));
    await entrar(page);
    await page.getByRole('radio', { name: 'Semana' }).click();

    const agora = await caixaDe(page.locator('.agora'));
    const rolagem = await caixaDe(page.locator('.rolagem'));
    const umaHora = (await caixaDe(page.locator('.grade'))).height / 24;

    // A linha de agora está dentro da área visível, com folga dos dois lados.
    expect(agora.y).toBeGreaterThan(rolagem.y + umaHora);
    expect(agora.y).toBeLessThan(rolagem.y + rolagem.height - umaHora);
  });

  test('numa semana sem hoje, a grade abre às 7h e não à meia-noite', async ({
    page,
  }) => {
    await page.clock.setFixedTime(new Date('2026-11-18T18:30:00.000Z'));
    await entrar(page);
    await page.getByRole('radio', { name: 'Semana' }).click();
    await page.getByRole('button', { name: 'Período seguinte' }).click();
    await expect(page.locator('.agora')).toHaveCount(0);

    const rolagem = await caixaDe(page.locator('.rolagem'));
    const sete = await caixaDe(
      page.locator('.eixo-hora', { hasText: /^\s*7h\s*$/ }),
    );
    const umaHora = (await caixaDe(page.locator('.grade'))).height / 24;

    // O rótulo de 7h está perto do topo da área visível.
    expect(sete.y).toBeGreaterThanOrEqual(rolagem.y);
    expect(sete.y).toBeLessThan(rolagem.y + umaHora * 2);
  });

  test('o eixo de horas não tem rótulo cortado no topo', async ({ page }) => {
    await entrar(page);
    await page.getByRole('radio', { name: 'Semana' }).click();
    await page.locator('.rolagem').evaluate((el) => {
      el.scrollTop = 0;
    });

    const rolagem = await caixaDe(page.locator('.rolagem'));
    const topos = await page
      .locator('.eixo-hora')
      .evaluateAll((rotulos) =>
        rotulos.map((r) => r.getBoundingClientRect().top),
      );

    // O primeiro rótulo ficava com metade para fora, escondida pela borda.
    for (const topo of topos) {
      expect(topo).toBeGreaterThanOrEqual(rolagem.y);
    }
  });

  test('os textos da grade são legíveis: rótulos de hora e eventos', async ({
    page,
  }) => {
    await entrar(page);
    await page.getByRole('radio', { name: 'Semana' }).click();

    const rotulo = await page
      .locator('.eixo-hora')
      .first()
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    // Toda semana tem uma terça e uma quinta, então há sempre uma "Academia".
    const evento = await page
      .locator('.faixa')
      .first()
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));

    expect(rotulo).toBeGreaterThanOrEqual(12);
    expect(evento).toBeGreaterThanOrEqual(13);
  });

  test('o estado vazio diz o que fazer, e não só que está vazio', async ({
    page,
  }) => {
    await entrar(page);
    for (const caixa of await page.getByRole('checkbox').all()) {
      await caixa.uncheck();
    }

    const vazio = page.locator('.vazio');
    await expect(vazio).toContainText('Nada em órbita por aqui');
    await expect(vazio).toContainText('Clique');
  });
});

test.describe('perfil e preferências', () => {
  test.beforeEach(async ({ page }) => {
    restaurarBanco();
    await page.setViewportSize({ width: 1280, height: 900 });
    await entrar(page);
  });

  test('o conteúdo de cada seção do perfil respira entre os blocos', async ({
    page,
  }) => {
    await page.goto('/perfil');
    await expect(page.locator('nb-sessoes-ativas ul')).toBeVisible();

    // Nas seções cujo conteúdo é um componente filho, o texto de apoio ficava
    // colado no campo, na lista ou no botão que vinha a seguir.
    const apertados = await page
      .locator('nb-troca-de-email, nb-sessoes-ativas, nb-apagar-conta')
      .evaluateAll((hosts) =>
        hosts.flatMap((host) => {
          const filhos = Array.from(host.children).map((f) =>
            f.getBoundingClientRect(),
          );
          return filhos
            .slice(1)
            .map((caixa, i) => caixa.top - filhos[i].bottom)
            .filter((vao) => vao < 12)
            .map((vao) => `${host.tagName.toLowerCase()}: ${vao.toFixed(1)}px`);
        }),
      );

    expect(apertados).toEqual([]);
  });

  test('apagar a conta tem a cor de perigo, e não a de um botão qualquer', async ({
    page,
  }) => {
    await page.goto('/perfil');

    const cor = await page
      .getByRole('button', { name: 'Apagar minha conta' })
      .evaluate((el) => getComputedStyle(el).color);
    const [r, g, b] = (cor.match(/\d+/g) ?? []).map(Number);

    // Rosa-avermelhado (`--state-danger`): vermelho alto, verde e azul baixos.
    expect(r).toBeGreaterThan(200);
    expect(g).toBeLessThan(150);
    expect(b).toBeLessThan(180);
  });

  for (const rota of ['/perfil', '/preferencias']) {
    test(`${rota}: não sobra um vão morto entre o título e o conteúdo`, async ({
      page,
    }) => {
      await page.goto(rota);

      const titulo = await caixaDe(page.getByRole('heading', { level: 1 }));
      const primeira = await caixaDe(page.locator('.secao').first());

      // A linha de estado (vazia) abria ~64px entre o título e o primeiro cartão.
      expect(primeira.y - (titulo.y + titulo.height)).toBeLessThan(40);
    });
  }
});

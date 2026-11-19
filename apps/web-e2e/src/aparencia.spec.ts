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

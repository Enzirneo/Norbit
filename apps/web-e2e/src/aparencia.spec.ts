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

/**
 * Avatar, Etiqueta, Cartão de seção e Cabeçalho de página, medidos no navegador.
 */
import { test, expect } from '@playwright/test';
import { corCalculada, entrar, restaurarBanco } from './apoio';

test.describe('identidade e estrutura', () => {
  test.beforeEach(async ({ page }) => {
    restaurarBanco();
    await page.setViewportSize({ width: 1280, height: 900 });
  });

  test('o avatar do perfil é um círculo grande, com as iniciais', async ({
    page,
  }) => {
    await entrar(page);
    await page.goto('/perfil');
    const avatar = page.locator('nb-avatar').first();

    const medidas = await avatar.evaluate((el) => {
      const e = getComputedStyle(el);
      return {
        largura: parseFloat(e.width),
        altura: parseFloat(e.height),
        raio: parseFloat(e.borderTopLeftRadius),
      };
    });

    expect(medidas.largura).toBe(56);
    expect(medidas.altura).toBe(56);
    expect(medidas.raio).toBeGreaterThan(1000);
    await expect(avatar).toHaveText(/^\w{1,2}$/);
  });

  test('o avatar do calendário é pequeno', async ({ page }) => {
    await entrar(page);

    const largura = await page
      .locator('nb-avatar')
      .first()
      .evaluate((el) => parseFloat(getComputedStyle(el).width));

    expect(largura).toBe(24);
  });

  test('o cartão de seção segue o raio de tela, e acompanha os cantos', async ({
    page,
  }) => {
    await entrar(page);
    await page.goto('/preferencias');
    const cartao = page.locator('.secao').first();
    const raio = (): Promise<number> =>
      cartao.evaluate((el) =>
        parseFloat(getComputedStyle(el).borderTopLeftRadius),
      );

    expect(await raio()).toBeCloseTo(9.6, 1);

    await page.evaluate(() =>
      document.documentElement.style.setProperty('--r', '0px'),
    );
    expect(await raio()).toBe(0);
  });

  test('as seções são regiões nomeadas pelo título', async ({ page }) => {
    await entrar(page);
    await page.goto('/seguranca');

    await expect(page.getByRole('region', { name: 'Senha' })).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'Aparelhos conectados' }),
    ).toBeVisible();
  });

  test('o título da página é o h1, e tem 1.5rem', async ({ page }) => {
    await entrar(page);
    await page.goto('/preferencias');

    const tamanho = await page
      .getByRole('heading', { level: 1, name: 'Preferências' })
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));

    expect(tamanho).toBe(24);
  });

  test('a etiqueta "Dono" é discreta, em caixa-alta e fonte mono', async ({
    page,
  }) => {
    await entrar(page);
    await page.getByRole('button', { name: /^Compartilhar Nós dois/ }).click();
    const etiqueta = page.locator('nb-etiqueta', { hasText: 'Dono' }).first();
    await expect(etiqueta).toBeVisible();

    const e = await etiqueta.evaluate((el) => {
      const c = getComputedStyle(el);
      return {
        transformacao: c.textTransform,
        cor: c.color,
        fonte: c.fontFamily,
      };
    });

    expect(e.transformacao).toBe('uppercase');
    expect(e.cor).toBe(await corCalculada(page, 'var(--text-muted)'));
    expect(e.fonte).toBe(
      await page.evaluate(() => {
        const s = document.createElement('i');
        s.style.fontFamily = 'var(--fonte-mono)';
        document.body.append(s);
        const f = getComputedStyle(s).fontFamily;
        s.remove();
        return f;
      }),
    );
  });
});

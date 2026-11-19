/**
 * O catálogo de design, sob cada tema pronto: axe e contraste.
 *
 * Cumpre a auditoria de acessibilidade do roadmap ("axe nos presets"): cada
 * componente em cada estado, em cada tema, sem violação de WCAG A/AA — o que
 * inclui `color-contrast`.
 *
 * O catálogo só existe no build de desenvolvimento. Num build de produção (o
 * que o CI serve) a rota cai na raiz, e estes testes se pulam.
 */
import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '@playwright/test';

const TEMAS = ['nebula', 'eclipse', 'dawn', 'vacuum'] as const;

async function abrirCatalogo(page: Page): Promise<void> {
  await page.goto('/design');
  // A rota é carregada sob demanda: espera o catálogo aparecer, e só então
  // conclui que ele não existe neste build.
  const existe = await page
    .locator('nb-catalogo')
    .waitFor({ timeout: 10_000 })
    .then(
      () => true,
      () => false,
    );
  // eslint-disable-next-line playwright/no-skipped-test -- o catálogo é só de desenvolvimento
  test.skip(!existe, 'O catálogo não existe neste build (produção).');
}

async function violacoes(page: Page): Promise<string[]> {
  const resultado = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  return resultado.violations.map(
    (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`,
  );
}

test.describe('catálogo de design', () => {
  for (const tema of TEMAS) {
    test(`${tema}: sem violação de acessibilidade, contraste incluído`, async ({
      page,
    }) => {
      await abrirCatalogo(page);
      await page.locator('#tema').selectOption(tema);

      expect(await violacoes(page)).toEqual([]);
    });

    test(`${tema} com contraste alto: sem violação`, async ({ page }) => {
      await abrirCatalogo(page);
      await page.locator('#tema').selectOption(tema);
      await page.locator('#contraste-alto').check();

      expect(await violacoes(page)).toEqual([]);
    });
  }

  test('com os cantos no máximo e sem estrelas continua sem violação', async ({
    page,
  }) => {
    await abrirCatalogo(page);
    await page.locator('#cantos').fill('16');
    await page.locator('#estrelas').uncheck();

    expect(await violacoes(page)).toEqual([]);
  });

  test('trocar o tema muda a página inteira', async ({ page }) => {
    await abrirCatalogo(page);

    await page.locator('#tema').selectOption('dawn');

    const fundo = await page.evaluate(() =>
      document.documentElement.style.getPropertyValue('--surface-base'),
    );
    expect(fundo).toBe('#f6f1ea');
  });

  test('uma semente extrema é ajustada e a pessoa é avisada', async ({
    page,
  }) => {
    await abrirCatalogo(page);

    await page.locator('#fundo').fill('#808080');

    await expect(page.locator('.avisos-do-motor').first()).toContainText(
      'Ajustamos',
    );
    expect(await violacoes(page)).toEqual([]);
  });
});

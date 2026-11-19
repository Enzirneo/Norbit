/**
 * O editor de tema e a moldura das configurações, no navegador.
 */
import { test, expect, type Page } from '@playwright/test';
import { entrar, restaurarBanco } from './apoio';

function variavel(page: Page, nome: string): Promise<string> {
  return page.evaluate(
    (n) => document.documentElement.style.getPropertyValue(n).trim(),
    nome,
  );
}

async function abrirAparencia(page: Page): Promise<void> {
  await entrar(page);
  await page.goto('/aparencia');
  await page.getByRole('button', { name: 'Salvar tema' }).waitFor();
}

test.describe('editor de tema', () => {
  test.beforeEach(async ({ page }) => {
    restaurarBanco();
    await page.setViewportSize({ width: 1280, height: 900 });
  });

  test('o menu das configurações leva às três áreas e marca onde se está', async ({
    page,
  }) => {
    await abrirAparencia(page);
    const menu = page.getByRole('navigation', { name: 'Configurações' });

    await expect(menu.getByRole('link', { name: 'Aparência' })).toHaveAttribute(
      'aria-current',
      'page',
    );

    await menu.getByRole('link', { name: 'Preferências' }).click();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Preferências' }),
    ).toBeVisible();

    await page
      .getByRole('navigation', { name: 'Configurações' })
      .getByRole('link', { name: 'Perfil' })
      .click();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Perfil' }),
    ).toBeVisible();
  });

  test('mostra a galeria com o tema da conta marcado', async ({ page }) => {
    await abrirAparencia(page);

    await expect(page.getByRole('radio', { name: /nebula/i })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(page.getByRole('radio', { name: /dawn/i })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  test('escolher um tema muda a página inteira na hora, mas não salva', async ({
    page,
  }) => {
    await abrirAparencia(page);

    await page.getByRole('radio', { name: /dawn/i }).click();

    await expect.poll(() => variavel(page, '--surface-base')).toBe('#f6f1ea');
    expect(
      await page.evaluate(() => localStorage.getItem('norbit:aparencia')),
    ).not.toContain('#f6f1ea');
  });

  test('sair sem salvar desfaz a prévia', async ({ page }) => {
    await abrirAparencia(page);
    await page.getByRole('radio', { name: /dawn/i }).click();
    await expect.poll(() => variavel(page, '--surface-base')).toBe('#f6f1ea');

    await page.getByRole('button', { name: 'Voltar ao calendário' }).click();

    await expect.poll(() => variavel(page, '--surface-base')).toBe('#0b0d17');
  });

  test('salvar guarda o tema na conta, e ele sobrevive a recarregar', async ({
    page,
  }) => {
    await abrirAparencia(page);
    await page.getByRole('radio', { name: /eclipse/i }).click();
    await page.getByRole('button', { name: 'Salvar tema' }).click();
    await expect(page.getByText('Tema salvo.')).toBeVisible();

    await page.reload();

    await expect.poll(() => variavel(page, '--surface-base')).toBe('#140a1f');
    await expect(page.getByRole('radio', { name: /eclipse/i })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  test('sem alteração, "Salvar tema" e "Desfazer" ficam desabilitados', async ({
    page,
  }) => {
    await abrirAparencia(page);

    await expect(
      page.getByRole('button', { name: 'Salvar tema' }),
    ).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Desfazer' })).toBeDisabled();
  });

  test('os cantos mudam o raio do app inteiro na prévia', async ({ page }) => {
    await abrirAparencia(page);

    await page.locator('#cantos').fill('16');

    await expect.poll(() => variavel(page, '--r')).toBe('16px');
    const raio = await page
      .locator('.secao')
      .first()
      .evaluate((el) => parseFloat(getComputedStyle(el).borderTopLeftRadius));
    expect(raio).toBeCloseTo(25.6, 1);
  });

  test('desligar a lua na prévia tira a lua do calendário, ao vivo', async ({
    page,
  }) => {
    await abrirAparencia(page);
    await page.locator('#lua').uncheck();
    await page.getByRole('button', { name: 'Salvar tema' }).click();
    await expect(page.getByText('Tema salvo.')).toBeVisible();

    await page.getByRole('button', { name: 'Voltar ao calendário' }).click();

    await expect(page.locator('nb-cartao-da-lua')).toHaveCount(0);
  });

  test('restaurar o tema padrão leva ao nebula, e pede para salvar', async ({
    page,
  }) => {
    await abrirAparencia(page);
    await page.getByRole('radio', { name: /vacuum/i }).click();
    await page.getByRole('button', { name: 'Salvar tema' }).click();
    await expect(page.getByText('Tema salvo.')).toBeVisible();

    await page.getByRole('button', { name: 'Restaurar o tema padrão' }).click();

    await expect.poll(() => variavel(page, '--surface-base')).toBe('#0b0d17');
    await expect(
      page.getByRole('button', { name: 'Salvar tema' }),
    ).toBeEnabled();
  });

  test('uma semente extrema mostra o aviso do motor junto às cores', async ({
    page,
  }) => {
    await abrirAparencia(page);

    await page.locator('#fundo').fill('#808080');

    await expect(page.locator('.avisos-do-motor').first()).toContainText(
      'Ajustamos',
    );
  });

  test('os seletores mostram o valor guardado, e não a primeira opção', async ({
    page,
  }) => {
    // O padrão da conta é densidade confortável (1): com a opção ainda por
    // desenhar quando o valor era aplicado, o seletor caía em "Compacta".
    await abrirAparencia(page);
    await expect(page.getByLabel('Densidade')).toHaveValue('1');

    await page.goto('/preferencias');
    await expect(page.getByLabel('Visão ao abrir')).toHaveValue('MONTH');
    await expect(page.getByLabel('A semana começa em')).toHaveValue('0');
  });
});

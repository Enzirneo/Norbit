/**
 * A cor de perfil: escolher, aparecer no avatar de quem a escolheu e, para quem
 * compartilha uma agenda, no avatar da lista de membros.
 */
import { test, expect, type Page } from '@playwright/test';
import { corCalculada, entrar, restaurarBanco } from './apoio';

const ROSA = '#ff6b8a';

function fundoDoAvatar(alvo: ReturnType<Page['locator']>): Promise<string> {
  return alvo.evaluate((el) => getComputedStyle(el).backgroundColor);
}

async function escolherCor(page: Page, cor: string): Promise<void> {
  await page.locator('#cor-de-perfil').fill(cor);
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByText('Perfil salvo.')).toBeVisible();
}

test.describe('cor de perfil', () => {
  test.beforeEach(async ({ page }) => {
    restaurarBanco();
    await page.setViewportSize({ width: 1280, height: 900 });
  });

  test('o avatar do perfil mostra a cor escolhida na hora, antes de salvar', async ({
    page,
  }) => {
    await entrar(page);
    await page.goto('/perfil');

    await page.locator('#cor-de-perfil').fill(ROSA);

    expect(await fundoDoAvatar(page.locator('nb-avatar').first())).toBe(
      await corCalculada(page, ROSA),
    );
  });

  test('salva, e o avatar do calendário passa a ter a cor', async ({
    page,
  }) => {
    await entrar(page);
    await page.goto('/perfil');
    await escolherCor(page, ROSA);

    await page.getByRole('button', { name: 'Voltar ao calendário' }).click();

    expect(await fundoDoAvatar(page.locator('.conta nb-avatar'))).toBe(
      await corCalculada(page, ROSA),
    );
  });

  test('a cor sobrevive a recarregar', async ({ page }) => {
    await entrar(page);
    await page.goto('/perfil');
    await escolherCor(page, ROSA);

    await page.reload();

    await expect(page.locator('#cor-de-perfil')).toHaveValue(ROSA);
  });

  test('"Usar a cor do tema" tira a cor', async ({ page }) => {
    await entrar(page);
    await page.goto('/perfil');
    await escolherCor(page, ROSA);

    await page.getByRole('button', { name: 'Usar a cor do tema' }).click();
    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect(page.getByText('Perfil salvo.').last()).toBeVisible();
    await page.getByRole('button', { name: 'Voltar ao calendário' }).click();

    expect(await fundoDoAvatar(page.locator('.conta nb-avatar'))).not.toBe(
      await corCalculada(page, ROSA),
    );
  });

  test('quem compartilha uma agenda vê a cor de perfil na lista de membros', async ({
    page,
  }) => {
    // A Maria, no seed, tem a cor #4adebb.
    await entrar(page);
    await page.getByRole('button', { name: /^Compartilhar Nós dois/ }).click();

    const maria = page
      .locator('.item', { hasText: 'Maria' })
      .locator('nb-avatar');
    expect(await fundoDoAvatar(maria)).toBe(
      await corCalculada(page, '#4adebb'),
    );

    const enzo = page
      .locator('.item', { hasText: 'Enzo' })
      .locator('nb-avatar');
    expect(await fundoDoAvatar(enzo)).not.toBe(
      await corCalculada(page, '#4adebb'),
    );
  });
});

/**
 * Os membros de uma agenda, de ponta a ponta: o dono muda papéis e remove
 * gente, e quem não é dono pode sair. O seed põe a Maria como editora de
 * "Nós dois", que é do Enzo.
 */
import { test, expect, type Page } from '@playwright/test';
import { entrar, restaurarBanco } from './apoio';

const MARIA = { email: 'maria@norbit.dev', senha: 'norbit123' };

async function abrirPainel(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Compartilhar Nós dois' }).click();
  await expect(
    page.getByRole('heading', { name: 'Compartilhar Nós dois' }),
  ).toBeVisible();
}

test.describe('membros da agenda', () => {
  test.beforeEach(() => {
    restaurarBanco();
  });

  test('o dono vê quem está na agenda, com o próprio papel fixo', async ({
    page,
  }) => {
    await entrar(page);
    await abrirPainel(page);

    await expect(page.getByText('@maria')).toBeVisible();
    await expect(page.getByText('Dono', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Papel de Maria')).toHaveValue('EDITOR');
  });

  test('mudar o papel é gravado: ao reabrir, continua', async ({ page }) => {
    await entrar(page);
    await abrirPainel(page);

    await page.getByLabel('Papel de Maria').selectOption('VIEWER');
    // Espera a gravação voltar do servidor (a lista é recarregada).
    await expect(page.getByLabel('Papel de Maria')).toHaveValue('VIEWER');

    await page.reload();
    await abrirPainel(page);

    await expect(page.getByLabel('Papel de Maria')).toHaveValue('VIEWER');
  });

  test('remover pede confirmação, e cancelar não remove', async ({ page }) => {
    await entrar(page);
    await abrirPainel(page);

    await page.getByRole('button', { name: 'Remover Maria' }).click();
    await page.getByRole('button', { name: 'Cancelar' }).click();

    await expect(page.getByText('@maria')).toBeVisible();

    await page.getByRole('button', { name: 'Remover Maria' }).click();
    await page.getByRole('button', { name: 'Confirmar remoção' }).click();

    await expect(page.getByText('@maria')).toHaveCount(0);
  });

  test('quem não é dono sai da agenda, e ela some da barra lateral', async ({
    page,
  }) => {
    await entrar(page, MARIA);

    await page.getByRole('button', { name: 'Sair de Nós dois' }).click();
    await page.getByRole('button', { name: 'Sair da agenda' }).click();

    await expect(
      page.getByRole('button', { name: 'Sair de Nós dois' }),
    ).toHaveCount(0);
    await expect(page.getByRole('checkbox', { name: 'Nós dois' })).toHaveCount(
      0,
    );
  });

  test('o dono não vê "Sair" na própria agenda', async ({ page }) => {
    await entrar(page);

    await expect(
      page.getByRole('button', { name: 'Compartilhar Nós dois' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Sair de Nós dois' }),
    ).toHaveCount(0);
  });
});

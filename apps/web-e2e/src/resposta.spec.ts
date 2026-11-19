/**
 * Alternador, Aviso e Toast, medidos no navegador.
 */
import { test, expect } from '@playwright/test';
import { corCalculada, entrar, restaurarBanco } from './apoio';

test.describe('resposta ao usuário', () => {
  test.beforeEach(() => {
    restaurarBanco();
  });

  test('um erro de login é um aviso de perigo: role alert e borda de perigo', async ({
    page,
  }) => {
    await page.goto('/entrar');
    await page.getByLabel('E-mail').fill('enzo@norbit.dev');
    await page.getByLabel('Senha').fill('senha-errada-123');
    await page.getByRole('button', { name: 'Entrar' }).click();

    const aviso = page.locator('nb-aviso[role="alert"]');
    await expect(aviso).toBeVisible();
    const borda = await aviso.evaluate(
      (el) => getComputedStyle(el).borderTopColor,
    );
    expect(borda).toBe(await corCalculada(page, 'var(--state-danger)'));
  });

  test('salvar o perfil mostra um toast de sucesso, que some sozinho', async ({
    page,
  }) => {
    await entrar(page);
    await page.goto('/perfil');
    await page.getByRole('button', { name: 'Salvar', exact: true }).click();

    const toast = page.locator('.toast', { hasText: 'Perfil salvo.' });
    await expect(toast).toBeVisible();
    await expect(toast).toHaveAttribute('role', 'status');
    await expect(toast).toBeHidden({ timeout: 8000 });
  });

  test('o botão de fechar tira o toast na hora', async ({ page }) => {
    await entrar(page);
    await page.goto('/perfil');
    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect(page.locator('.toast')).toBeVisible();

    await page.getByRole('button', { name: 'Fechar aviso' }).click();

    await expect(page.locator('.toast')).toHaveCount(0);
  });

  test('mudar uma preferência mostra "Preferências salvas."', async ({
    page,
  }) => {
    await entrar(page);
    await page.goto('/preferencias');
    await page.getByLabel('Relógio de 24 horas').click();

    await expect(page.getByText('Preferências salvas.')).toBeVisible();
  });

  test('o alternador de visão troca com as setas, e o foco acompanha', async ({
    page,
  }) => {
    await entrar(page);
    const semana = page.getByRole('radio', { name: 'Semana' });
    await semana.focus();

    await page.keyboard.press('ArrowRight');

    const dia = page.getByRole('radio', { name: 'Dia' });
    await expect(dia).toHaveAttribute('aria-checked', 'true');
    await expect(dia).toBeFocused();
  });
});

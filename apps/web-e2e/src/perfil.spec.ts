/**
 * O perfil: nome, handle e fuso.
 *
 * As regras de cada campo têm teste no contrato e na API; o que só aqui se prova
 * é a costura — a tela mostra o que está salvo, salva, e o valor sobrevive a
 * recarregar a página.
 */
import { test, expect } from '@playwright/test';
import { entrar, restaurarBanco } from './apoio';

test.describe('perfil', () => {
  test.beforeEach(() => {
    restaurarBanco();
  });

  test('o calendário tem o atalho, e a tela abre com os dados atuais', async ({
    page,
  }) => {
    await entrar(page);

    await page.getByRole('link', { name: 'Perfil' }).click();

    await expect(
      page.getByRole('heading', { name: 'Perfil', level: 1 }),
    ).toBeVisible();
    await expect(page.getByLabel('Handle')).toHaveValue('enzo');
    await expect(page.getByLabel('Nome de exibição')).not.toHaveValue('');
  });

  test('salvar muda nome e handle, e sobrevive a recarregar', async ({
    page,
  }) => {
    await entrar(page);
    await page.goto('/perfil');

    await page.getByLabel('Nome de exibição').fill('Enzo Renomeado');
    await page.getByLabel('Handle').fill('Enzo_Novo');
    await page.getByRole('button', { name: 'Salvar' }).click();

    await expect(page.getByText('Perfil salvo.')).toBeVisible();
    // A forma canônica volta para o formulário: handle em minúsculas.
    await expect(page.getByLabel('Handle')).toHaveValue('enzo_novo');

    await page.reload();

    await expect(page.getByLabel('Nome de exibição')).toHaveValue(
      'Enzo Renomeado',
    );
    await expect(page.getByLabel('Handle')).toHaveValue('enzo_novo');
  });

  test('um handle que já é de outra pessoa é recusado', async ({ page }) => {
    await entrar(page);
    await page.goto('/perfil');

    await page.getByLabel('Handle').fill('maria');
    await page.getByRole('button', { name: 'Salvar' }).click();

    await expect(page.getByRole('alert')).toContainText('já está em uso');
  });

  test('um fuso que não existe é recusado com a mensagem do contrato', async ({
    page,
  }) => {
    await entrar(page);
    await page.goto('/perfil');

    await page.getByLabel('Fuso horário').fill('Marte/Olympus');
    await page.getByRole('button', { name: 'Salvar' }).click();

    await expect(page.getByText(/Fuso horário desconhecido/)).toBeVisible();
  });

  test('o fuso salvo vale na próxima abertura', async ({ page }) => {
    await entrar(page);
    await page.goto('/perfil');

    await page.getByLabel('Fuso horário').fill('america/manaus');
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByText('Perfil salvo.')).toBeVisible();

    await page.reload();

    await expect(page.getByLabel('Fuso horário')).toHaveValue('America/Manaus');
  });
});

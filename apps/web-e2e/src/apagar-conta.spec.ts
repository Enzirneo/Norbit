/**
 * Apagar a conta, de ponta a ponta.
 *
 * As regras (o que some, o que fica, o que barra) têm teste no serviço contra o
 * banco. O que só aqui se prova é a costura: a confirmação pede a senha, a
 * recusa do servidor chega à tela com o nome da agenda, e depois de apagar a
 * pessoa vai para o login e não consegue mais entrar.
 */
import { test, expect, type Page } from '@playwright/test';
import { entrar, restaurarBanco } from './apoio';

const ENZO = { email: 'enzo@norbit.dev', senha: 'norbit123' };
const MARIA = { email: 'maria@norbit.dev', senha: 'norbit123' };

async function pedirParaApagar(page: Page, senha: string): Promise<void> {
  await page.goto('/perfil');
  await page.getByRole('button', { name: 'Apagar minha conta' }).click();
  await page.getByLabel('Senha para confirmar').fill(senha);
  await page
    .getByRole('button', { name: 'Apagar a conta para sempre' })
    .click();
}

test.describe('apagar a conta', () => {
  test.beforeEach(() => {
    restaurarBanco();
  });

  test('o botão só abre a confirmação, que pode ser cancelada', async ({
    page,
  }) => {
    await entrar(page, MARIA);
    await page.goto('/perfil');

    await page.getByRole('button', { name: 'Apagar minha conta' }).click();
    await expect(page.getByLabel('Senha para confirmar')).toBeVisible();

    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByLabel('Senha para confirmar')).toHaveCount(0);
    await expect(page).toHaveURL(/\/perfil/);
  });

  test('senha errada é recusada, e a conta continua', async ({ page }) => {
    await entrar(page, MARIA);
    await pedirParaApagar(page, 'não é a minha senha');

    await expect(page.getByRole('alert')).toContainText(
      'A senha está incorreta.',
    );
    await expect(page).toHaveURL(/\/perfil/);
  });

  test('quem é dono de agenda compartilhada é barrado, com o nome dela', async ({
    page,
  }) => {
    await entrar(page, ENZO);
    await pedirParaApagar(page, ENZO.senha);

    await expect(page.getByRole('alert')).toContainText('Nós dois');
    await expect(page).toHaveURL(/\/perfil/);
  });

  test('apagada a conta, a pessoa vai para o login e não entra mais', async ({
    page,
  }) => {
    await entrar(page, MARIA);
    await pedirParaApagar(page, MARIA.senha);

    await expect(page).toHaveURL(/\/entrar/);

    await page.getByLabel('E-mail').fill(MARIA.email);
    await page.getByLabel('Senha').fill(MARIA.senha);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
  });
});

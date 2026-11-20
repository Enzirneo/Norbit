/**
 * A área de Segurança: e-mail, senha, aparelhos e apagar conta.
 *
 * Saiu do Perfil: quem abre "Perfil" quer mudar nome e cor, e quem quer trocar
 * a senha ou apagar a conta procura "Segurança". O que cada formulário faz já
 * tem teste próprio; aqui se prova a separação.
 */
import { AxeBuilder } from '@axe-core/playwright';
import { test, expect } from '@playwright/test';
import { entrar, restaurarBanco } from './apoio';

const SECOES_DE_SEGURANCA = [
  'E-mail',
  'Senha',
  'Aparelhos conectados',
  'Apagar conta',
];

test.describe('segurança', () => {
  test.beforeEach(() => {
    restaurarBanco();
  });

  test('o menu das configurações leva à área, e ela marca onde a pessoa está', async ({
    page,
  }) => {
    await entrar(page);
    await page.goto('/perfil');

    await page
      .getByRole('navigation', { name: 'Configurações' })
      .getByRole('link', { name: 'Segurança' })
      .click();

    await expect(page).toHaveURL(/\/seguranca/);
    await expect(
      page.getByRole('heading', { name: 'Segurança', level: 1 }),
    ).toBeVisible();
    await expect(
      page
        .getByRole('navigation', { name: 'Configurações' })
        .getByRole('link', { name: 'Segurança' }),
    ).toHaveAttribute('aria-current', 'page');
  });

  test('tem as quatro seções, cada uma como região nomeada', async ({
    page,
  }) => {
    await entrar(page);
    await page.goto('/seguranca');

    for (const nome of SECOES_DE_SEGURANCA) {
      await expect(page.getByRole('region', { name: nome })).toBeVisible();
    }
  });

  test('o Perfil ficou só com a identidade: nada de segurança lá', async ({
    page,
  }) => {
    await entrar(page);
    await page.goto('/perfil');

    await expect(page.getByRole('region', { name: 'Você' })).toBeVisible();
    for (const nome of SECOES_DE_SEGURANCA) {
      await expect(page.getByRole('region', { name: nome })).toHaveCount(0);
    }
  });

  test('sem a rota autenticada, a área pede entrada', async ({ page }) => {
    await page.goto('/seguranca');

    await expect(page).toHaveURL(/\/entrar/);
  });

  test('passa na auditoria de acessibilidade', async ({ page }) => {
    await entrar(page);
    await page.goto('/seguranca');
    await expect(
      page.getByRole('heading', { name: 'Segurança', level: 1 }),
    ).toBeVisible();

    const resultado = await new AxeBuilder({ page }).analyze();

    expect(resultado.violations).toEqual([]);
  });
});

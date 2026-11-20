/**
 * Aparelhos conectados, de ponta a ponta.
 *
 * A regra de quais sessões aparecem e de quem pode derrubar o quê tem teste no
 * serviço. O que só aqui se prova é a costura: o cookie chega à API (senão nada
 * seria marcado como "este aparelho") e derrubar um aparelho o tira de verdade
 * da conta.
 */
import { test, expect, type Browser, type Page } from '@playwright/test';
import { entrar, restaurarBanco } from './apoio';

async function outroAparelho(
  browser: Browser,
  baseURL: string | undefined,
): Promise<Page> {
  const contexto = await browser.newContext({ baseURL });
  const pagina = await contexto.newPage();
  await entrar(pagina);
  return pagina;
}

test.describe('aparelhos conectados', () => {
  test.beforeEach(() => {
    restaurarBanco();
  });

  test('lista este aparelho, sem botão, e os outros, com botão', async ({
    page,
    browser,
    baseURL,
  }) => {
    const celular = await outroAparelho(browser, baseURL);

    await entrar(page);
    await page.goto('/seguranca');

    const aparelhos = page.getByRole('list', { name: 'Aparelhos conectados' });
    await expect(aparelhos.getByRole('listitem')).toHaveCount(2);

    const este = aparelhos.locator('[data-atual="true"]');
    await expect(este).toHaveCount(1);
    await expect(este).toContainText('Este aparelho');
    await expect(este.getByRole('button', { name: /Desconectar/ })).toHaveCount(
      0,
    );

    await expect(
      aparelhos.locator('[data-atual="false"]').getByRole('button', {
        name: /Desconectar/,
      }),
    ).toHaveCount(1);

    await celular.context().close();
  });

  test('desconectar um aparelho o tira da conta, e este continua dentro', async ({
    page,
    browser,
    baseURL,
  }) => {
    const celular = await outroAparelho(browser, baseURL);

    await entrar(page);
    await page.goto('/seguranca');
    await page.getByRole('button', { name: /Desconectar/ }).click();

    const aparelhos = page.getByRole('list', { name: 'Aparelhos conectados' });
    await expect(aparelhos.getByRole('listitem')).toHaveCount(1);

    // O aparelho derrubado perde a sessão quando tenta renová-la...
    await celular.reload();
    await expect(celular).toHaveURL(/\/entrar/);

    // ...e este segue na conta.
    await page.reload();
    await expect(page).toHaveURL(/\/seguranca/);

    await celular.context().close();
  });
});

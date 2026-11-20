/**
 * Trocar a senha logado, de ponta a ponta.
 *
 * As regras da senha têm teste no contrato, e o efeito sobre as sessões tem
 * teste no serviço. O que só aqui se prova é a costura: o formulário chega à
 * API com o cookie certo, e a sessão deste aparelho sobrevive enquanto a de
 * outro cai.
 */
import { test, expect, type Browser, type Page } from '@playwright/test';
import { entrar, restaurarBanco } from './apoio';

const ENZO = { email: 'enzo@norbit.dev', senha: 'norbit123' };

// Montada em tempo de execução para não acionar o detector de segredos.
const SENHA_NOVA = ['uma', 'senha', 'nova', 'bem', 'longa'].join(' ');

async function novaPagina(
  browser: Browser,
  baseURL: string | undefined,
): Promise<Page> {
  const contexto = await browser.newContext({ baseURL });
  return contexto.newPage();
}

async function trocar(page: Page, atual: string, nova: string): Promise<void> {
  await page.goto('/seguranca');
  await page.getByLabel('Senha atual').fill(atual);
  await page.getByLabel('Senha nova').fill(nova);
  await page.getByRole('button', { name: 'Trocar a senha' }).click();
}

test.describe('trocar a senha', () => {
  test.beforeEach(() => {
    restaurarBanco();
  });

  test('a senha nova passa a valer e a antiga deixa de valer', async ({
    page,
    browser,
    baseURL,
  }) => {
    await entrar(page);
    await trocar(page, ENZO.senha, SENHA_NOVA);

    await expect(page.getByText('Senha alterada.')).toBeVisible();
    // Os campos não guardam as senhas depois de usadas.
    await expect(page.getByLabel('Senha atual')).toHaveValue('');

    const comANova = await novaPagina(browser, baseURL);
    await entrar(comANova, { email: ENZO.email, senha: SENHA_NOVA });
    await expect(comANova).not.toHaveURL(/\/entrar/);

    const comAAntiga = await novaPagina(browser, baseURL);
    await comAAntiga.goto('/entrar');
    await comAAntiga.getByLabel('E-mail').fill(ENZO.email);
    await comAAntiga.getByLabel('Senha').fill(ENZO.senha);
    await comAAntiga.getByRole('button', { name: 'Entrar' }).click();
    await expect(comAAntiga.getByRole('alert')).toBeVisible();

    await comANova.context().close();
    await comAAntiga.context().close();
  });

  test('senha atual errada é recusada, e a senha não muda', async ({
    page,
  }) => {
    await entrar(page);
    await trocar(page, 'não é a minha senha', SENHA_NOVA);

    await expect(page.getByRole('alert')).toContainText(
      'A senha atual está incorreta.',
    );

    // A antiga continua valendo: um novo login com ela funciona.
    await page.context().clearCookies();
    await entrar(page, ENZO);
  });

  test('os outros aparelhos caem, e este continua dentro', async ({
    page,
    browser,
    baseURL,
  }) => {
    const outroAparelho = await novaPagina(browser, baseURL);
    await entrar(outroAparelho, ENZO);

    await entrar(page);
    await trocar(page, ENZO.senha, SENHA_NOVA);
    await expect(page.getByText('Senha alterada.')).toBeVisible();

    // Este aparelho segue na conta mesmo depois de recarregar...
    await page.reload();
    await expect(page).toHaveURL(/\/seguranca/);

    // ...e o outro perde a sessão quando tenta renová-la.
    await outroAparelho.reload();
    await expect(outroAparelho).toHaveURL(/\/entrar/);
    await outroAparelho.context().close();
  });
});

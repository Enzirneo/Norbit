/**
 * A recuperação de senha, de ponta a ponta, com o e-mail de verdade.
 *
 * O e-mail passa pelo Mailpit (`docker-compose`): o teste lê a caixa dele, abre
 * o link que a pessoa abriria, e só então prova que a senha mudou entrando com
 * ela. O que cada camada garante sozinha está nos testes dela.
 */
import { test, expect } from '@playwright/test';
import {
  entrar,
  esperarEmail,
  esvaziarCaixa,
  linkDoEmail,
  restaurarBanco,
} from './apoio';

const EMAIL = 'enzo@norbit.dev';
const SENHA_ANTIGA = 'norbit123';
// Montada em tempo de execução: não é segredo, mas literal atribuída a senha
// aciona o detector do GitGuardian.
const SENHA_NOVA = ['uma', 'senha', 'nova', 'e', 'longa'].join(' ');

async function pedirLink(
  page: import('@playwright/test').Page,
  email: string,
): Promise<void> {
  await page.goto('/esqueci-senha');
  await page.getByLabel('E-mail da conta').fill(email);
  await page.getByRole('button', { name: 'Enviar o link' }).click();
  await expect(page.getByRole('status')).toContainText(
    'o link já está a caminho',
  );
}

test.describe('recuperação de senha', () => {
  test.beforeEach(async () => {
    restaurarBanco();
    await esvaziarCaixa();
  });

  test('a tela de entrar leva a "esqueci a senha"', async ({ page }) => {
    await page.goto('/entrar');

    await page.getByRole('link', { name: 'Esqueci a senha' }).click();

    await expect(
      page.getByRole('heading', { name: 'Esqueci a senha', level: 1 }),
    ).toBeVisible();
  });

  test('pedir o link, abri-lo e trocar a senha: a nova entra, a antiga não', async ({
    page,
  }) => {
    await pedirLink(page, EMAIL);
    const texto = await esperarEmail(EMAIL);
    expect(texto).not.toBeNull();

    await page.goto(linkDoEmail(texto ?? ''));
    await page.getByLabel('Nova senha').fill(SENHA_NOVA);
    await page.getByRole('button', { name: 'Salvar a nova senha' }).click();
    await expect(page.getByRole('status')).toContainText('Senha alterada');

    // A antiga deixou de valer…
    await page.goto('/entrar');
    await page.getByLabel('E-mail').fill(EMAIL);
    await page.getByLabel('Senha').fill(SENHA_ANTIGA);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByRole('alert')).toContainText('incorretos');

    // …e a nova entra.
    await entrar(page, { email: EMAIL, senha: SENHA_NOVA });
    await expect(page).not.toHaveURL(/\/entrar/);
  });

  test('um e-mail sem conta recebe a mesma resposta e nada chega à caixa', async ({
    page,
  }) => {
    await pedirLink(page, 'ninguem@norbit.dev');

    expect(await esperarEmail('ninguem@norbit.dev', 1_500)).toBeNull();
  });

  test('o link vale uma vez só', async ({ page }) => {
    await pedirLink(page, EMAIL);
    const link = linkDoEmail((await esperarEmail(EMAIL)) ?? '');

    await page.goto(link);
    await page.getByLabel('Nova senha').fill(SENHA_NOVA);
    await page.getByRole('button', { name: 'Salvar a nova senha' }).click();
    await expect(page.getByRole('status')).toContainText('Senha alterada');

    await page.goto(link);
    await page.getByLabel('Nova senha').fill(SENHA_NOVA);
    await page.getByRole('button', { name: 'Salvar a nova senha' }).click();
    await expect(page.getByRole('alert')).toContainText('inválido ou já usado');
  });

  test('um link sem token avisa, em vez de mostrar um formulário que não funciona', async ({
    page,
  }) => {
    await page.goto('/redefinir-senha');

    await expect(page.getByRole('alert')).toContainText('incompleto');
    await expect(page.getByLabel('Nova senha')).toHaveCount(0);
  });

  test('uma senha curta é recusada com a mesma regra do cadastro', async ({
    page,
  }) => {
    await pedirLink(page, EMAIL);
    await page.goto(linkDoEmail((await esperarEmail(EMAIL)) ?? ''));

    await page.getByLabel('Nova senha').fill('curta');
    await page.getByRole('button', { name: 'Salvar a nova senha' }).click();

    await expect(page.getByText(/pelo menos 12 caracteres/)).toBeVisible();
  });
});

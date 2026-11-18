/**
 * Trocar o e-mail, de ponta a ponta, com o Mailpit de verdade.
 *
 * As regras (nada muda até o clique, link de uso único, endereço tomado) têm
 * teste no serviço. O que só aqui se prova é a costura: o formulário chega à
 * API, o e-mail chega ao endereço novo com um link que abre a tela certa, e a
 * confirmação derruba a sessão e troca o login.
 */
import { test, expect, type Browser, type Page } from '@playwright/test';
import {
  entrar,
  esperarEmail,
  esvaziarCaixa,
  linkDeConfirmacaoNoEmail,
  restaurarBanco,
} from './apoio';

const MARIA = { email: 'maria@norbit.dev', senha: 'norbit123' };
const NOVO = 'maria.nova@norbit.dev';

async function pedirTroca(
  page: Page,
  novoEmail: string,
  senha: string,
): Promise<void> {
  await page.goto('/perfil');
  await page.getByLabel('E-mail novo').fill(novoEmail);
  await page.getByLabel('Senha para trocar o e-mail').fill(senha);
  await page.getByRole('button', { name: 'Trocar o e-mail' }).click();
}

async function abrirLinkSemSessao(
  browser: Browser,
  baseURL: string | undefined,
  link: string,
): Promise<Page> {
  const contexto = await browser.newContext({ baseURL });
  const pagina = await contexto.newPage();
  await pagina.goto(link);
  return pagina;
}

test.describe('trocar o e-mail', () => {
  test.beforeEach(async () => {
    restaurarBanco();
    await esvaziarCaixa();
  });

  test('o link chega ao endereço novo, e confirmar troca o login', async ({
    page,
    browser,
    baseURL,
  }) => {
    await entrar(page, MARIA);
    await pedirTroca(page, NOVO, MARIA.senha);
    await expect(page.getByRole('status')).toContainText(
      `Se ${NOVO} puder ser usado`,
    );

    const texto = await esperarEmail(NOVO);
    expect(texto).not.toBeNull();

    // Abre o link num aparelho sem sessão, como acontece com quem lê o e-mail
    // no celular.
    const outro = await abrirLinkSemSessao(
      browser,
      baseURL,
      linkDeConfirmacaoNoEmail(texto ?? ''),
    );
    await outro.getByRole('button', { name: 'Confirmar a troca' }).click();
    await expect(outro.getByRole('status')).toContainText('E-mail trocado');

    // O endereço antigo é avisado.
    const aviso = await esperarEmail(MARIA.email);
    expect(aviso).toContain('foi trocado');

    // Entra com o novo...
    await entrar(outro, { email: NOVO, senha: MARIA.senha });
    await outro.context().close();

    // ...e o antigo deixa de valer.
    const antigo = await browser.newContext({ baseURL });
    const paginaAntiga = await antigo.newPage();
    await paginaAntiga.goto('/entrar');
    await paginaAntiga.getByLabel('E-mail').fill(MARIA.email);
    await paginaAntiga.getByLabel('Senha').fill(MARIA.senha);
    await paginaAntiga.getByRole('button', { name: 'Entrar' }).click();
    await expect(paginaAntiga.getByRole('alert')).toBeVisible();
    await antigo.close();
  });

  test('confirmar derruba a sessão de quem pediu', async ({
    page,
    browser,
    baseURL,
  }) => {
    await entrar(page, MARIA);
    await pedirTroca(page, NOVO, MARIA.senha);
    const texto = await esperarEmail(NOVO);

    const outro = await abrirLinkSemSessao(
      browser,
      baseURL,
      linkDeConfirmacaoNoEmail(texto ?? ''),
    );
    await outro.getByRole('button', { name: 'Confirmar a troca' }).click();
    await expect(outro.getByRole('status')).toContainText('E-mail trocado');
    await outro.context().close();

    await page.reload();
    await expect(page).toHaveURL(/\/entrar/);
  });

  test('senha errada é recusada, e nada é enviado', async ({ page }) => {
    await entrar(page, MARIA);
    await pedirTroca(page, NOVO, 'não é a minha senha');

    await expect(page.getByRole('alert')).toContainText(
      'A senha está incorreta.',
    );
    expect(await esperarEmail(NOVO, 1_500)).toBeNull();
  });

  test('endereço que já tem conta responde igual, mas não envia nada', async ({
    page,
  }) => {
    await entrar(page, MARIA);
    await pedirTroca(page, 'enzo@norbit.dev', MARIA.senha);

    // A tela não revela que o endereço tem dono...
    await expect(page.getByRole('status')).toContainText('puder ser usado');
    // ...e ninguém recebe nada.
    expect(await esperarEmail('enzo@norbit.dev', 1_500)).toBeNull();
  });

  test('um link inventado é recusado na tela', async ({ browser, baseURL }) => {
    const outro = await abrirLinkSemSessao(
      browser,
      baseURL,
      '/confirmar-email?token=inventado',
    );
    await outro.getByRole('button', { name: 'Confirmar a troca' }).click();

    await expect(outro.getByRole('alert')).toContainText('Link inválido');
    await outro.context().close();
  });
});

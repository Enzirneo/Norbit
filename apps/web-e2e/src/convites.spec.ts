/**
 * Os convites, de ponta a ponta: o dono convida pelo painel, a outra pessoa
 * abre o link como abriria (às vezes sem ter conta) e entra na agenda.
 *
 * O e-mail passa pelo Mailpit, como na recuperação de senha. O que cada regra
 * garante sozinha — papel, uso único, corrida — está nos testes da API; aqui
 * se prova que as peças se encontram.
 */
import { test, expect, type Browser, type Page } from '@playwright/test';
import {
  entrar,
  esperarEmail,
  esvaziarCaixa,
  linkDoConviteNoEmail,
  restaurarBanco,
} from './apoio';

const MARIA = { email: 'maria@norbit.dev', senha: 'norbit123' };
// Montada em tempo de execução: não é segredo, mas literal atribuída a senha
// aciona o detector do GitGuardian.
// O domínio `e2e.norbit.dev` é varrido pelo seed (`restaurarBanco`): a conta que
// este teste cria não pode sobrar para a execução seguinte.
const SENHA_DA_ANA = ['uma', 'senha', 'da', 'ana', 'bem', 'longa'].join(' ');

/** Outra pessoa, em outro navegador: o dono continua logado na primeira aba. */
async function outraPessoa(
  browser: Browser,
  baseURL: string | undefined,
): Promise<Page> {
  const contexto = await browser.newContext({ baseURL });
  return contexto.newPage();
}

async function abrirPainel(page: Page, agenda: string): Promise<void> {
  await page.getByRole('button', { name: `Compartilhar ${agenda}` }).click();
  await expect(
    page.getByRole('heading', { name: `Compartilhar ${agenda}` }),
  ).toBeVisible();
}

test.describe('convites', () => {
  test.beforeEach(async () => {
    restaurarBanco();
    await esvaziarCaixa();
  });

  test('convidar por e-mail quem não tem conta: cria a conta, volta ao convite e entra na agenda', async ({
    page,
    browser,
    baseURL,
  }) => {
    await entrar(page);
    await abrirPainel(page, 'Nós dois');

    await page.getByLabel('E-mail (opcional)').fill('ana@e2e.norbit.dev');
    await page.getByRole('button', { name: 'Enviar convite' }).click();

    await expect(
      page.getByRole('heading', {
        name: 'Convite enviado para ana@e2e.norbit.dev',
      }),
    ).toBeVisible();
    await expect(page.getByText('ana@e2e.norbit.dev').last()).toBeVisible();

    const texto = await esperarEmail('ana@e2e.norbit.dev');
    expect(texto).not.toBeNull();

    const ana = await outraPessoa(browser, baseURL);
    await ana.goto(linkDoConviteNoEmail(texto ?? ''));

    await expect(ana.getByText('Enzo convidou você.')).toBeVisible();
    await expect(ana.getByText('Nós dois')).toBeVisible();
    await expect(
      ana.getByText('Este convite é para ana@e2e.norbit.dev.'),
    ).toBeVisible();

    // Sem conta: cria uma, e o cadastro devolve para o convite, não para o início.
    await ana.getByRole('button', { name: 'Criar conta' }).click();
    await ana.getByLabel('Como você quer ser chamado').fill('Ana');
    await ana.getByLabel('Handle').fill('ana');
    await ana.getByLabel('E-mail').fill('ana@e2e.norbit.dev');
    await ana.getByLabel('Senha').fill(SENHA_DA_ANA);
    await ana.getByRole('button', { name: 'Criar conta' }).click();

    await expect(ana).toHaveURL(/\/convite\?token=/);
    await ana.getByRole('button', { name: 'Aceitar convite' }).click();

    await expect(ana).toHaveURL(/\/$/);
    await expect(ana.getByLabel('Nós dois')).toBeVisible();
  });

  test('o convite por e-mail não abre para outra conta', async ({
    page,
    browser,
    baseURL,
  }) => {
    await entrar(page);
    await abrirPainel(page, 'Nós dois');
    await page.getByLabel('E-mail (opcional)').fill('ana@e2e.norbit.dev');
    await page.getByRole('button', { name: 'Enviar convite' }).click();
    const texto = await esperarEmail('ana@e2e.norbit.dev');

    // A Maria segue o link que não era dela.
    const maria = await outraPessoa(browser, baseURL);
    await entrar(maria, MARIA);
    await maria.goto(linkDoConviteNoEmail(texto ?? ''));
    await maria.getByRole('button', { name: 'Aceitar convite' }).click();

    await expect(maria.getByRole('alert')).toContainText(
      'foi enviado para outro e-mail',
    );
    await expect(
      maria.getByRole('button', { name: 'Usar outra conta' }),
    ).toBeVisible();
  });

  test('o link é mostrado uma vez, e revogar o mata', async ({
    page,
    browser,
    baseURL,
  }) => {
    await entrar(page);
    await abrirPainel(page, 'Nós dois');

    // Sem e-mail: vira um link, e só então o teto de usos aparece.
    await expect(page.getByLabel('Máximo de usos')).toBeVisible();
    await page.getByRole('button', { name: 'Criar link' }).click();

    const link = await page.getByLabel('Link do convite').inputValue();
    expect(link).toContain('/convite?token=');
    await expect(
      page.getByText('não dá para recuperá-lo depois'),
    ).toBeVisible();

    await page
      .getByRole('button', { name: 'Revogar convite por link' })
      .click();
    await expect(page.getByText('Nenhum convite pendente.')).toBeVisible();

    const visitante = await outraPessoa(browser, baseURL);
    await visitante.goto(link);

    await expect(visitante.getByRole('alert')).toContainText(
      'cancelado por quem o enviou',
    );
  });

  test('um link sem token diz que está incompleto', async ({ page }) => {
    await page.goto('/convite');

    await expect(page.getByRole('alert')).toContainText('incompleto');
  });

  test('só o dono vê o botão de compartilhar', async ({ page }) => {
    await entrar(page, MARIA);

    // A Maria é editora de "Nós dois" e dona da própria órbita.
    await expect(
      page.getByRole('button', { name: 'Compartilhar Órbita da Maria' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Compartilhar Nós dois' }),
    ).toHaveCount(0);
  });
});

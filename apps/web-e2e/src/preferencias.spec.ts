/**
 * As preferências da conta.
 *
 * A derivação de cores tem 47 testes em `libs/design-tokens`, e os contratos e a
 * API têm os seus. O que só aqui se prova é a costura: que a escolha chega ao
 * documento, que sobrevive a recarregar a página, e que o calendário passa a
 * obedecê-la.
 */
import { test, expect, type Page } from '@playwright/test';
import { entrar, restaurarBanco } from './apoio';

/** O valor atual de uma custom property na raiz do documento. */
async function variavel(page: Page, nome: string): Promise<string> {
  return page.evaluate(
    (n) => document.documentElement.style.getPropertyValue(n).trim(),
    nome,
  );
}

test.describe('preferências', () => {
  test.beforeEach(() => {
    restaurarBanco();
  });

  test('o calendário tem o atalho para as preferências', async ({ page }) => {
    await entrar(page);

    await page.getByRole('link', { name: 'Preferências' }).click();

    await expect(
      page.getByRole('heading', { name: 'Preferências', level: 1 }),
    ).toBeVisible();
  });

  test('trocar o acento muda a cor aplicada ao documento', async ({ page }) => {
    await entrar(page);
    await page.goto('/preferencias');

    await page.getByRole('radio', { name: 'Aurora' }).click();

    await expect.poll(() => variavel(page, '--accent')).toBe('#4adebb');
  });

  test('o texto sobre o acento acompanha a derivação, não é fixo', async ({
    page,
  }) => {
    // Os cinco acentos pedem frente escura, mas a cor da frente é *derivada* do
    // contraste — e esse teste garante que ela está sendo escrita no documento.
    await entrar(page);
    await page.goto('/preferencias');

    await page.getByRole('radio', { name: 'Solar' }).click();

    await expect.poll(() => variavel(page, '--text-on-accent')).toBe('#070812');
  });

  test('a escolha sobrevive a recarregar a página', async ({ page }) => {
    // O ponto de guardar no servidor: um `localStorage` esqueceria ao trocar de
    // navegador, e esta preferência vale para a conta.
    await entrar(page);
    await page.goto('/preferencias');
    await page.getByRole('radio', { name: 'Pulsar' }).click();
    await expect.poll(() => variavel(page, '--accent')).toBe('#ff6b8a');

    await page.reload();

    await expect.poll(() => variavel(page, '--accent')).toBe('#ff6b8a');
  });

  test('a aparência vale antes de o Angular carregar e antes da API responder', async ({
    page,
  }) => {
    // O ponto do cache: sem ele a tela nasce com o acento padrão e troca de cor
    // diante de quem olha. Para provar que o valor vem do cache e **não** do
    // servidor, a API de preferências é bloqueada na recarga — ela nunca
    // responde, e o acento tem de estar lá do mesmo jeito.
    await entrar(page);
    await page.goto('/preferencias');
    await page.getByRole('radio', { name: 'Pulsar' }).click();
    await expect.poll(() => variavel(page, '--accent')).toBe('#ff6b8a');

    await page.route('**/api/preferencias', (rota) => rota.abort());

    // `commit`: devolve assim que a navegação começa a responder, bem antes de
    // o Angular existir. Ler a variável aqui só passa se o script do
    // `index.html` já rodou.
    await page.goto('/preferencias', { waitUntil: 'commit' });
    await page.waitForFunction(() => document.readyState !== 'loading');

    expect(await variavel(page, '--accent')).toBe('#ff6b8a');
  });

  test('sair apaga a aparência guardada', async ({ page }) => {
    // A aparência é informação sobre quem usava o navegador: a próxima pessoa
    // não deve ver, nem por um instante, a cor da anterior.
    await entrar(page);
    await page.goto('/preferencias');
    await page.getByRole('radio', { name: 'Solar' }).click();
    await expect.poll(() => variavel(page, '--accent')).toBe('#ffb357');

    await page.getByRole('button', { name: 'Voltar ao calendário' }).click();
    await page.getByRole('button', { name: 'Sair' }).click();
    await page.waitForURL(/\/entrar/);

    const guardado = await page.evaluate(() =>
      localStorage.getItem('norbit:aparencia'),
    );
    expect(guardado).toBeNull();
  });

  test('a densidade muda a unidade de espaçamento', async ({ page }) => {
    await entrar(page);
    await page.goto('/preferencias');

    await page.getByLabel('Densidade').selectOption('0');
    await expect.poll(() => variavel(page, '--space-unit')).toBe('3px');

    await page.getByLabel('Densidade').selectOption('2');
    await expect.poll(() => variavel(page, '--space-unit')).toBe('5px');
  });

  test('reduzir movimento liga o atributo na raiz', async ({ page }) => {
    await entrar(page);
    await page.goto('/preferencias');

    await page.getByLabel(/Reduzir movimento/).check();

    await expect(page.locator('html')).toHaveAttribute(
      'data-sem-movimento',
      '',
    );
  });

  test('a visão ao abrir é a que a pessoa escolheu', async ({ page }) => {
    await entrar(page);
    await page.goto('/preferencias');
    await page.getByLabel('Visão ao abrir').selectOption('DAY');
    await expect(page.getByLabel('Visão ao abrir')).toHaveValue('DAY');

    await page.getByRole('button', { name: 'Voltar ao calendário' }).click();

    // A escolha chega ao calendário sem ele precisar saber de onde veio.
    await expect(page.getByRole('radio', { name: 'Dia' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  test('o início da semana muda a primeira coluna', async ({ page }) => {
    await entrar(page);
    await page.goto('/preferencias');
    await page.getByLabel('A semana começa em').selectOption('1');
    await expect(page.getByLabel('A semana começa em')).toHaveValue('1');

    await page.getByRole('button', { name: 'Voltar ao calendário' }).click();

    await expect(page.locator('.nome-do-dia').first()).toHaveText('Seg');
  });

  test('esconder uma agenda sobrevive a recarregar', async ({ page }) => {
    // Antes era um `Set` só de sessão, com um aviso na tela dizendo que a
    // escolha não era guardada. Agora é `CalendarMember.isHidden`.
    await entrar(page);
    await expect(page.locator('.barra').first()).toBeVisible();

    const caixa = page.getByRole('checkbox', { name: /Nós dois/ });
    await caixa.uncheck();
    await expect(caixa).not.toBeChecked();

    await page.reload();

    await expect(
      page.getByRole('checkbox', { name: /Nós dois/ }),
    ).not.toBeChecked();
  });
});

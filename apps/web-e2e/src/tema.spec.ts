/**
 * O tema da pessoa chega do servidor e vira a aparência da tela inteira.
 */
import { test, expect, type Page } from '@playwright/test';
import { corCalculada, entrar, restaurarBanco } from './apoio';

const MARIA = { email: 'maria@norbit.dev', senha: 'norbit123' };

function variavel(page: Page, nome: string): Promise<string> {
  return page.evaluate(
    (n) => document.documentElement.style.getPropertyValue(n),
    nome,
  );
}

type Forma = {
  cantos: number;
  estrelas: boolean;
  lua: boolean;
  hemisferio: 'sul' | 'norte';
};

/** Faz o servidor responder com um tema de outra forma, para provar o que a web faz com ele. */
async function servirForma(page: Page, forma: Forma): Promise<void> {
  await page.route('**/api/preferencias', async (rota) => {
    if (rota.request().method() !== 'GET') {
      return rota.continue();
    }
    const resposta = await rota.fetch();
    const corpo = (await resposta.json()) as { tema: Record<string, unknown> };
    await rota.fulfill({
      response: resposta,
      json: { ...corpo, tema: { ...corpo.tema, forma } },
    });
  });
}

const FORMA_PADRAO: Forma = {
  cantos: 6,
  estrelas: true,
  lua: true,
  hemisferio: 'sul',
};

test.describe('tema', () => {
  test.beforeEach(() => {
    restaurarBanco();
  });

  test('quem tem o tema escuro padrão vê as superfícies escuras', async ({
    page,
  }) => {
    await entrar(page);

    expect(await variavel(page, '--surface-base')).toBe('#0b0d17');
    expect(await variavel(page, 'color-scheme')).toBe('dark');
  });

  test('uma conta com o preset claro (dawn) abre com o tema claro de verdade', async ({
    page,
  }) => {
    await entrar(page, MARIA);

    expect(await variavel(page, '--surface-base')).toBe('#f6f1ea');
    expect(await variavel(page, 'color-scheme')).toBe('light');
    // E o que se vê é claro: o fundo calculado do corpo.
    const fundo = await page.evaluate(
      () => getComputedStyle(document.body).backgroundColor,
    );
    expect(fundo).toBe(await corCalculada(page, '#f6f1ea'));
  });

  test('o texto do tema claro é escuro, e legível', async ({ page }) => {
    await entrar(page, MARIA);

    const [texto, fundo] = await page.evaluate(() => {
      const e = getComputedStyle(document.body);
      return [e.color, e.backgroundColor];
    });
    const claridade = (rgb: string): number =>
      (rgb.match(/\d+/g) ?? []).slice(0, 3).reduce((a, b) => a + Number(b), 0);

    expect(claridade(texto)).toBeLessThan(claridade(fundo));
  });

  test('o tema que vem do servidor muda a forma: cantos e estrelas', async ({
    page,
  }) => {
    // O servidor responde com um tema de outra forma: o que se prova aqui é que
    // a web o aplica inteiro (a API já é coberta por testes de integração).
    await page.route('**/api/preferencias', async (rota) => {
      if (rota.request().method() !== 'GET') {
        return rota.continue();
      }
      const resposta = await rota.fetch();
      const corpo = (await resposta.json()) as Record<string, unknown>;
      await rota.fulfill({
        response: resposta,
        json: {
          ...corpo,
          tema: {
            v: 1,
            base: null,
            sementes: {
              fundo: '#06141b',
              destaque: '#4adebb',
              contraste: 'normal',
            },
            forma: {
              cantos: 14,
              estrelas: false,
              lua: true,
              hemisferio: 'sul',
            },
          },
        },
      });
    });

    await entrar(page);

    expect(await variavel(page, '--r')).toBe('14px');
    expect(await variavel(page, '--estrelas')).toBe('0');
    expect(await variavel(page, '--surface-base')).toBe('#06141b');
    expect(await variavel(page, '--accent')).toBe('#4adebb');
  });

  test('ao sair, a tela de entrada volta ao tema padrão', async ({ page }) => {
    await entrar(page, MARIA);
    expect(await variavel(page, '--surface-base')).toBe('#f6f1ea');

    await page.getByRole('button', { name: 'Sair', exact: true }).click();
    await page.waitForURL(/\/entrar/);

    expect(await variavel(page, '--surface-base')).toBe('');
  });

  test('com a lua desligada, nenhuma lua aparece no calendário', async ({
    page,
  }) => {
    await servirForma(page, { ...FORMA_PADRAO, lua: false });

    await entrar(page);

    await expect(page.locator('nb-cartao-da-lua')).toHaveCount(0);
    await expect(page.locator('nb-lua')).toHaveCount(0);
  });

  test('com a lua ligada, ela aparece no cartão e nas colunas', async ({
    page,
  }) => {
    await entrar(page);

    await expect(page.locator('nb-cartao-da-lua')).toHaveCount(1);
    expect(await page.locator('nb-lua').count()).toBeGreaterThan(1);
  });

  test('o hemisfério norte espelha o lado iluminado da lua', async ({
    page,
  }) => {
    await page.clock.setFixedTime(new Date('2026-11-24T12:00:00Z'));
    const luz = (): Promise<string> =>
      page
        .locator('nb-cartao-da-lua .luz')
        .getAttribute('d')
        .then((d) => d ?? '');

    await entrar(page);
    const sul = await luz();
    await page.unroute('**/api/preferencias');
    await servirForma(page, { ...FORMA_PADRAO, hemisferio: 'norte' });
    await page.reload();
    await page.locator('nb-cartao-da-lua').waitFor();
    const norte = await luz();

    expect(norte).not.toBe(sul);
  });
});

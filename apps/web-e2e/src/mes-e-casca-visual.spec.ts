/**
 * O mês e a casca (barra lateral e topo) na linguagem "o calendário como
 * protagonista", a mesma da semana e do dia.
 *
 * Mede o que o navegador calcula, como `semana-visual.spec.ts`. Os eventos que o
 * teste mede ele mesmo cria: os do seed são relativos ao dia real em que a
 * suíte roda.
 */
import { test, expect, type Locator, type Page } from '@playwright/test';
import { entrar, restaurarBanco } from './apoio';

// 15h30 de quarta, 18 de novembro de 2026, em São Paulo.
const AGORA_FIXO = new Date('2026-11-18T18:30:00.000Z');

async function criarEventoAs9h(page: Page, titulo: string): Promise<void> {
  await page.getByRole('radio', { name: 'Dia' }).click();
  await page.getByRole('button', { name: /^Criar evento às 9h/ }).click();
  await page.getByLabel('Título').fill(titulo);
  await page.getByRole('button', { name: 'Criar evento', exact: true }).click();
  await expect(page.locator('.faixa', { hasText: titulo })).toBeVisible();
}

async function abrirMesComEvento(page: Page): Promise<Locator> {
  await entrar(page);
  await criarEventoAs9h(page, 'Evento do mês');
  await page.getByRole('radio', { name: 'Mês' }).click();
  const barra = page.locator('.barra', { hasText: 'Evento do mês' });
  await expect(barra).toBeVisible();
  return barra;
}

function raio(alvo: Locator): Promise<number> {
  return alvo.evaluate((el) =>
    parseFloat(getComputedStyle(el).borderTopLeftRadius),
  );
}

/** A claridade percebida de uma cor `rgb(...)`, de 0 a 255. */
function claridade(cor: string): number {
  const [r, g, b] = (cor.match(/[\d.]+/g) ?? []).map(Number);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

test.describe('mês', () => {
  test.beforeEach(async ({ page }) => {
    restaurarBanco();
    await page.setViewportSize({ width: 1280, height: 900 });
  });

  test('cada dia do mês tem a fase da lua', async ({ page }) => {
    await entrar(page);

    const dias = await page.locator('.fundo').count();
    const luas = page.locator('.numero-area nb-lua svg');

    await expect(luas).toHaveCount(dias);
    await expect(luas.first()).toHaveAttribute(
      'aria-label',
      /^(Lua nova|Crescente|Quarto crescente|Gibosa crescente|Lua cheia|Gibosa minguante|Quarto minguante|Minguante), \d+% iluminada$/,
    );
  });

  test('a barra do evento tem 3px na cor da agenda, e o raio de evento', async ({
    page,
  }) => {
    const barra = await abrirMesComEvento(page);

    const estilo = await barra.evaluate((el) => {
      const e = getComputedStyle(el);
      return {
        largura: parseFloat(e.borderLeftWidth),
        cor: e.borderLeftColor,
        raio: parseFloat(e.borderTopLeftRadius),
      };
    });
    const corDaAgenda = await page
      .locator('.agenda-caixa')
      .first()
      .evaluate((el) => getComputedStyle(el).accentColor);

    expect(estilo.largura).toBe(3);
    expect(estilo.cor).toBe(corDaAgenda);
    // `--r-ev` com cantos de 6px.
    expect(estilo.raio).toBeCloseTo(2.1, 1);
  });

  test('o horário na barra do mês é monoespaçado', async ({ page }) => {
    const barra = await abrirMesComEvento(page);

    const familia = await barra
      .locator('.barra-hora')
      .evaluate((el) => getComputedStyle(el).fontFamily);

    expect(familia).toContain('monospace');
  });

  test('o quadro do mês segue o raio da tela, e acompanha os cantos', async ({
    page,
  }) => {
    await entrar(page);
    const quadro = page.locator('.grade');

    expect(await raio(quadro)).toBeCloseTo(13.2, 1);

    await page.evaluate(() =>
      document.documentElement.style.setProperty('--r', '16px'),
    );
    expect(await raio(quadro)).toBeCloseTo(35.2, 1);
  });

  /**
   * A cor do número de um dia. `indice` escolhe entre os dias de mesmo número que
   * a grade mostra duas vezes (o 10 de novembro e o 10 de dezembro): 0 é o do mês.
   */
  async function corDoNumero(
    page: Page,
    dia: number,
    indice = 0,
  ): Promise<string> {
    return page
      .locator('.numero-area')
      .filter({ hasText: new RegExp(`^\\s*${dia}\\s*$`) })
      .nth(indice)
      .locator('.numero')
      .evaluate((el) => getComputedStyle(el).color);
  }

  test('os dias que já passaram têm o número mais apagado que os que vêm', async ({
    page,
  }) => {
    await page.clock.setFixedTime(AGORA_FIXO);
    await entrar(page);

    const passado = claridade(await corDoNumero(page, 10));
    const futuro = claridade(await corDoNumero(page, 25));

    expect(passado).toBeLessThan(futuro);
  });

  test('os dias de fora do mês são ainda mais apagados que os que já passaram', async ({
    page,
  }) => {
    await page.clock.setFixedTime(AGORA_FIXO);
    await entrar(page);

    // O passado já é apagado: o dia de outro mês precisa ser mais ainda. Comparar
    // com um dia futuro não provaria nada, porque qualquer cor apagada perde.
    // 10 de dezembro (índice 1) é futuro, mas está fora de novembro.
    const fora = claridade(await corDoNumero(page, 10, 1));
    const passado = claridade(await corDoNumero(page, 10, 0));

    expect(fora).toBeLessThan(passado);
  });

  test('hoje brilha no mês', async ({ page }) => {
    await entrar(page);

    const brilho = await page
      .locator('.numero--hoje')
      .evaluate((el) => getComputedStyle(el).boxShadow);

    expect(brilho).not.toBe('none');
  });
});

test.describe('casca', () => {
  test.beforeEach(async ({ page }) => {
    restaurarBanco();
    await page.setViewportSize({ width: 1280, height: 900 });
  });

  test('a barra lateral chama as agendas de órbitas', async ({ page }) => {
    await entrar(page);

    await expect(
      page.locator('.lateral').getByRole('heading', { name: 'Órbitas' }),
    ).toBeVisible();
  });

  test('o cartão da lua mostra a fase de hoje, com o nome e a iluminação', async ({
    page,
  }) => {
    await entrar(page);

    const cartao = page.locator('.cartao-da-lua');
    await expect(cartao).toBeVisible();
    await expect(cartao).toContainText(
      /Lua nova|Crescente|Quarto crescente|Gibosa crescente|Lua cheia|Gibosa minguante|Quarto minguante|Minguante/,
    );
    await expect(cartao).toContainText(/\d+% iluminada hoje/);
    await expect(cartao.locator('nb-lua svg')).toHaveCount(1);
  });

  test('os controles da barra lateral e do topo seguem os cantos', async ({
    page,
  }) => {
    await entrar(page);
    const alvos = [
      page.locator('.agenda-acao').first(),
      page.locator('.lateral-link').first(),
      page.locator('.visao').first(),
    ];

    // `--raio-p` é o próprio `--r`: 6px, e 16px quando a pessoa pede.
    for (const alvo of alvos) {
      expect(await raio(alvo)).toBeCloseTo(6, 1);
    }

    await page.evaluate(() =>
      document.documentElement.style.setProperty('--r', '16px'),
    );
    for (const alvo of alvos) {
      expect(await raio(alvo)).toBeCloseTo(16, 1);
    }
  });
});

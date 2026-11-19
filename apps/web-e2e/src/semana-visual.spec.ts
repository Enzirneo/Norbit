/**
 * A semana e o dia na linguagem "o calendário como protagonista".
 *
 * Mede o que o navegador calcula: o evento mais reto que a moldura, a barra de
 * cor, o horário em fonte monoespaçada, o passado escurecendo, a lua em cada dia
 * e o "agora" como uma órbita. É o método dos PRs visuais anteriores: o teste de
 * componente não enxerga CSS.
 *
 * Os eventos que o teste mede ele mesmo cria: os do seed são relativos a "hoje" e
 * cairiam fora da semana conforme o dia em que a suíte roda.
 */
import { test, expect, type Locator, type Page } from '@playwright/test';
import { corDaPrimeiraOrbita, entrar, restaurarBanco } from './apoio';

async function criarEventoAs9h(page: Page, titulo: string): Promise<void> {
  await page.getByRole('radio', { name: 'Dia' }).click();
  await page.getByRole('button', { name: /^Criar evento às 9h/ }).click();
  await page.getByLabel('Título').fill(titulo);
  await page.getByRole('button', { name: 'Criar evento', exact: true }).click();
  await expect(page.locator('.faixa', { hasText: titulo })).toBeVisible();
}

async function abrirSemanaComEvento(page: Page): Promise<Locator> {
  await entrar(page);
  await criarEventoAs9h(page, 'Reunião visual');
  await page.getByRole('radio', { name: 'Semana' }).click();
  const faixa = page.locator('.faixa', { hasText: 'Reunião visual' });
  await expect(faixa).toBeVisible();
  return faixa;
}

/**
 * Quanto da coluna, de cima para baixo, a camada do passado cobre: de 0 a 1.
 * Zero quando a camada nem existe (o futuro).
 */
async function fracaoEscurecida(coluna: Locator): Promise<number> {
  const passado = coluna.locator('.passado');
  if ((await passado.count()) === 0) {
    return 0;
  }

  const alturaDaColuna = (await coluna.boundingBox())?.height ?? 1;
  return ((await passado.boundingBox())?.height ?? 0) / alturaDaColuna;
}

test.describe('semana e dia', () => {
  test.beforeEach(async ({ page }) => {
    restaurarBanco();
    await page.setViewportSize({ width: 1280, height: 900 });
  });

  test('o evento é mais reto que a moldura, e os dois acompanham os cantos', async ({
    page,
  }) => {
    const faixa = await abrirSemanaComEvento(page);
    const quadro = page.locator('.quadro');

    const raios = async (): Promise<[number, number]> => [
      await faixa.evaluate((el) =>
        parseFloat(getComputedStyle(el).borderTopLeftRadius),
      ),
      await quadro.evaluate((el) =>
        parseFloat(getComputedStyle(el).borderTopLeftRadius),
      ),
    ];

    // Cantos padrão (6px): evento = 6 × 0,35; moldura = 6 × 2,2.
    const [evento, moldura] = await raios();
    expect(evento).toBeCloseTo(2.1, 1);
    expect(moldura).toBeCloseTo(13.2, 1);

    // Cantos redondos (16px): os dois crescem, e o evento segue mais reto.
    await page.evaluate(() =>
      document.documentElement.style.setProperty('--r', '16px'),
    );
    const [eventoRedondo, molduraRedonda] = await raios();
    expect(eventoRedondo).toBeCloseTo(5.6, 1);
    expect(molduraRedonda).toBeCloseTo(35.2, 1);
    expect(eventoRedondo).toBeLessThan(molduraRedonda);

    // Cantos retos (0): tudo reto.
    await page.evaluate(() =>
      document.documentElement.style.setProperty('--r', '0px'),
    );
    const [eventoReto, molduraReta] = await raios();
    expect(eventoReto).toBe(0);
    expect(molduraReta).toBe(0);
  });

  test('o evento tem uma barra de 3px na cor da agenda', async ({ page }) => {
    const faixa = await abrirSemanaComEvento(page);

    const barra = await faixa.evaluate((el) => {
      const estilo = getComputedStyle(el);
      return {
        largura: parseFloat(estilo.borderLeftWidth),
        cor: estilo.borderLeftColor,
      };
    });
    // A cor da agenda, como a barra lateral a mostra na caixa de seleção.
    const corDaAgenda = await corDaPrimeiraOrbita(page);

    expect(barra.largura).toBe(3);
    expect(barra.cor).toBe(corDaAgenda);
  });

  test('o horário do evento é monoespaçado', async ({ page }) => {
    const faixa = await abrirSemanaComEvento(page);

    const familia = await faixa
      .locator('.faixa-hora')
      .evaluate((el) => getComputedStyle(el).fontFamily);

    expect(familia).toContain('monospace');
  });

  test('o passado escurece até a linha de agora, e o futuro não', async ({
    page,
  }) => {
    // 15h30 de quarta, 18 de novembro, em São Paulo.
    await page.clock.setFixedTime(new Date('2026-11-18T18:30:00.000Z'));
    await entrar(page);
    await page.getByRole('radio', { name: 'Semana' }).click();

    const colunas = page.locator('.coluna');
    // Espera a grade terminar de desenhar antes de medir: sem isto, a leitura
    // logo depois do clique pode ver a coluna ainda sem a camada do passado.
    await expect(colunas).toHaveCount(7);
    await expect(colunas.nth(3).locator('.passado')).toBeVisible();
    const fracao = (indice: number): Promise<number> =>
      fracaoEscurecida(colunas.nth(indice));

    // Domingo 15 (índice 0) e terça 17 (índice 2): já passaram, escurecem inteiros.
    expect(await fracao(0)).toBeCloseTo(1, 1);
    expect(await fracao(2)).toBeCloseTo(1, 1);
    // Quarta 18 (índice 3): até as 15h30, que é 15,5/24 do dia.
    expect(await fracao(3)).toBeCloseTo(15.5 / 24, 1);
    // Quinta 19 (índice 4) e sábado 21 (índice 6): ainda vêm, não escurecem.
    expect(await fracao(4)).toBe(0);
    expect(await fracao(6)).toBe(0);
  });

  test('cada dia da semana tem a fase da lua', async ({ page }) => {
    await entrar(page);
    await page.getByRole('radio', { name: 'Semana' }).click();

    const luas = page.locator('.dias nb-lua svg');
    await expect(luas).toHaveCount(7);

    const rotulos = await luas.evaluateAll((els) =>
      els.map((el) => el.getAttribute('aria-label')),
    );
    for (const rotulo of rotulos) {
      expect(rotulo).toMatch(
        /^(Lua nova|Crescente|Quarto crescente|Gibosa crescente|Lua cheia|Gibosa minguante|Quarto minguante|Minguante), \d+% iluminada$/,
      );
    }
  });

  test('a visão de dia tem uma lua só, a do dia', async ({ page }) => {
    await entrar(page);
    await page.getByRole('radio', { name: 'Dia' }).click();

    await expect(page.locator('.dias nb-lua svg')).toHaveCount(1);
  });

  test('o "agora" é uma órbita: um anel com brilho, e não um ponto', async ({
    page,
  }) => {
    await page.clock.setFixedTime(new Date('2026-11-18T18:30:00.000Z'));
    await entrar(page);
    await page.getByRole('radio', { name: 'Semana' }).click();

    const marcador = await page.locator('.agora').evaluate((el) => {
      const estilo = getComputedStyle(el, '::before');
      return {
        borda: parseFloat(estilo.borderTopWidth),
        largura: parseFloat(estilo.width),
        sombra: estilo.boxShadow,
      };
    });

    expect(marcador.borda).toBeGreaterThanOrEqual(1);
    expect(marcador.largura).toBeGreaterThanOrEqual(10);
    expect(marcador.sombra).not.toBe('none');
  });

  test('hoje brilha no cabeçalho', async ({ page }) => {
    await entrar(page);
    await page.getByRole('radio', { name: 'Semana' }).click();

    const brilho = await page
      .locator('.dia-numero--hoje')
      .evaluate((el) => getComputedStyle(el).boxShadow);

    expect(brilho).not.toBe('none');
  });

  test('a camada do passado não bloqueia cliques: dá para criar numa hora que já passou', async ({
    page,
  }) => {
    // 15h30 de quarta: as 9h de segunda e de hoje já passaram, e estão sob a camada.
    await page.clock.setFixedTime(new Date('2026-11-18T18:30:00.000Z'));
    await entrar(page);
    await page.getByRole('radio', { name: 'Semana' }).click();

    await page
      .getByRole('button', { name: /^Criar evento às 9h de 16 de novembro/ })
      .click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByLabel('Título')).toBeVisible();
  });

  test('o evento de dia inteiro tem a mesma barra de cor e o mesmo raio do evento com hora', async ({
    page,
  }) => {
    await entrar(page);
    await page.getByRole('radio', { name: 'Dia' }).click();
    await page.getByRole('button', { name: /^Criar evento às 9h/ }).click();
    await page.getByLabel('Título').fill('Feriado visual');
    await page.getByLabel('Dia inteiro').check();
    await page
      .getByRole('button', { name: 'Criar evento', exact: true })
      .click();
    await page.getByRole('radio', { name: 'Semana' }).click();

    const faixa = page.locator('.faixa-dia-inteiro', {
      hasText: 'Feriado visual',
    });
    await expect(faixa).toBeVisible();

    const estilo = await faixa.evaluate((el) => {
      const e = getComputedStyle(el);
      return {
        barra: parseFloat(e.borderLeftWidth),
        raio: parseFloat(e.borderTopLeftRadius),
        cor: e.borderLeftColor,
      };
    });
    const corDaAgenda = await corDaPrimeiraOrbita(page);

    expect(estilo.barra).toBe(3);
    expect(estilo.raio).toBeCloseTo(2.1, 1);
    expect(estilo.cor).toBe(corDaAgenda);
  });
});

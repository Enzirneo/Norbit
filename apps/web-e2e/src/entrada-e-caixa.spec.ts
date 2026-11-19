/**
 * Entrada e Caixa: os controles de formulário, medidos no navegador.
 *
 * Havia duas definições de campo (a global e uma cópia local em dois arquivos),
 * com raio em múltiplo de `--space-unit` e fonte de 15px. Agora é uma só, no
 * raio de forma (`--raio-p`) e com 16px: abaixo disso o iPhone dá zoom na tela
 * ao focar o campo, e o app vai para o iPhone.
 *
 * As variações (rádio, desabilitado, `textarea`) são medidas em **sondas**:
 * elementos criados na página com a mesma classe, para não ser preciso navegar
 * até cada fluxo que as usa.
 */
import { test, expect, type Locator, type Page } from '@playwright/test';
import {
  corCalculada,
  corDaPrimeiraOrbita,
  entrar,
  restaurarBanco,
} from './apoio';

function raio(alvo: Locator): Promise<number> {
  return alvo.evaluate((el) =>
    parseFloat(getComputedStyle(el).borderTopLeftRadius),
  );
}

async function estilosDeUmaSonda(
  page: Page,
  html: string,
): Promise<Record<string, string>> {
  return page.evaluate((marcacao) => {
    const caixa = document.createElement('div');
    caixa.innerHTML = marcacao;
    document.body.append(caixa);
    const alvo = caixa.firstElementChild as HTMLElement;
    const e = getComputedStyle(alvo);
    const lido = {
      raio: e.borderTopLeftRadius,
      largura: e.width,
      altura: e.height,
      fundo: e.backgroundColor,
      borda: e.borderTopColor,
      opacidade: e.opacity,
      cursor: e.cursor,
      redimensiona: e.resize,
      fonte: e.fontSize,
      marca: getComputedStyle(alvo, '::after').content,
    };
    caixa.remove();
    return lido;
  }, html);
}

test.describe('entrada', () => {
  test.beforeEach(() => {
    restaurarBanco();
  });

  test('o campo segue o raio de forma, e acompanha os cantos', async ({
    page,
  }) => {
    await page.goto('/entrar');
    const campo = page.getByLabel('E-mail');

    expect(await raio(campo)).toBeCloseTo(6, 1);

    await page.evaluate(() =>
      document.documentElement.style.setProperty('--r', '16px'),
    );
    expect(await raio(campo)).toBeCloseTo(16, 1);
  });

  test('o texto do campo tem 16px: abaixo disso o iPhone dá zoom ao focar', async ({
    page,
  }) => {
    await page.goto('/entrar');

    const fonte = await page
      .getByLabel('E-mail')
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));

    expect(fonte).toBe(16);
  });

  test('ao focar, a borda assume a cor de foco', async ({ page }) => {
    await page.goto('/entrar');
    const campo = page.getByLabel('E-mail');

    const antes = await campo.evaluate(
      (el) => getComputedStyle(el).borderTopColor,
    );
    await campo.focus();
    const depois = await campo.evaluate(
      (el) => getComputedStyle(el).borderTopColor,
    );

    expect(depois).toBe(await corCalculada(page, 'var(--border-focus)'));
    expect(depois).not.toBe(antes);
  });

  test('um campo inválido tem a borda de perigo', async ({ page }) => {
    await page.goto('/entrar');
    const campo = page.getByLabel('E-mail');
    await campo.evaluate((el) => el.setAttribute('aria-invalid', 'true'));

    const borda = await campo.evaluate(
      (el) => getComputedStyle(el).borderTopColor,
    );

    expect(borda).toBe(await corCalculada(page, 'var(--state-danger)'));
  });

  test('o formulário do evento usa o mesmo campo: raio e 16px', async ({
    page,
  }) => {
    await entrar(page);
    await page.getByRole('radio', { name: 'Dia' }).click();
    await page.getByRole('button', { name: /^Criar evento às 9h/ }).click();

    const titulo = page.getByLabel('Título');
    const estilo = await titulo.evaluate((el) => ({
      raio: parseFloat(getComputedStyle(el).borderTopLeftRadius),
      fonte: parseFloat(getComputedStyle(el).fontSize),
    }));

    expect(estilo.raio).toBeCloseTo(6, 1);
    expect(estilo.fonte).toBe(16);
  });

  test('com "Dia inteiro", o campo de data ocupa a largura toda, como os outros', async ({
    page,
  }) => {
    await entrar(page);
    await page.getByRole('radio', { name: 'Dia' }).click();
    await page.getByRole('button', { name: /^Criar evento às 9h/ }).click();
    await page.getByLabel('Dia inteiro').check();

    const largura = (alvo: Locator): Promise<number> =>
      alvo.evaluate((el) => el.getBoundingClientRect().width);

    // Sem a hora, a data fica sozinha na linha: a coluna da hora não pode
    // continuar reservada (e o intervalo entre as duas, com ela).
    const titulo = await largura(page.getByLabel('Título'));
    const data = await largura(page.locator('input[type="date"]').first());

    expect(Math.abs(titulo - data)).toBeLessThan(1);
  });

  test('os seletores das preferências seguem o raio de forma', async ({
    page,
  }) => {
    await entrar(page);
    await page.goto('/preferencias');

    expect(await raio(page.getByLabel('Densidade'))).toBeCloseTo(6, 1);
  });

  test('desabilitado fica apagado e sem cursor de clique', async ({ page }) => {
    await page.goto('/entrar');

    const e = await estilosDeUmaSonda(
      page,
      '<input class="nb-entrada" disabled />',
    );

    expect(parseFloat(e['opacidade'])).toBeLessThan(1);
    expect(e['cursor']).toBe('not-allowed');
  });

  test('a área de texto só cresce na vertical', async ({ page }) => {
    await page.goto('/entrar');

    const e = await estilosDeUmaSonda(
      page,
      '<textarea class="nb-entrada"></textarea>',
    );

    expect(e['redimensiona']).toBe('vertical');
  });
});

test.describe('caixa', () => {
  test.beforeEach(() => {
    restaurarBanco();
  });

  test('a caixa de uma órbita tem o tamanho e o raio de forma', async ({
    page,
  }) => {
    await entrar(page);
    const caixa = page.locator('.agenda-caixa').first();

    const medidas = await caixa.evaluate((el) => {
      const e = getComputedStyle(el);
      return {
        largura: parseFloat(e.width),
        altura: parseFloat(e.height),
        raio: parseFloat(e.borderTopLeftRadius),
      };
    });

    expect(medidas.largura).toBe(18);
    expect(medidas.altura).toBe(18);
    // 60% do raio-base: a caixa é menor que um campo, e cantos iguais a engoliriam.
    expect(medidas.raio).toBeCloseTo(3.6, 1);
  });

  test('marcada, a caixa de uma órbita se enche da cor da órbita; desmarcada, esvazia', async ({
    page,
  }) => {
    await entrar(page);
    const caixa = page.locator('.agenda-caixa').first();
    const corDaOrbita = await corDaPrimeiraOrbita(page);

    const fundo = (): Promise<string> =>
      caixa.evaluate((el) => getComputedStyle(el).backgroundColor);

    expect(await fundo()).toBe(corDaOrbita);

    await caixa.uncheck();
    expect(await fundo()).toBe('rgba(0, 0, 0, 0)');
  });

  test('marcada, a caixa mostra o sinal de marcado', async ({ page }) => {
    await entrar(page);
    const caixa = page.locator('.agenda-caixa').first();

    const marca = await caixa.evaluate(
      (el) => getComputedStyle(el, '::after').content,
    );

    expect(marca).not.toBe('none');
  });

  test('uma caixa sem cor de órbita usa o destaque do tema', async ({
    page,
  }) => {
    await entrar(page);
    await page.goto('/preferencias');
    const caixa = page.getByLabel('Relógio de 24 horas');

    // O padrão é 24 horas ligado.
    const fundo = await caixa.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );

    expect(fundo).toBe(await corCalculada(page, 'var(--accent)'));
  });

  test('o rádio é um círculo, e marcado se enche do destaque', async ({
    page,
  }) => {
    await page.goto('/entrar');

    const e = await estilosDeUmaSonda(
      page,
      '<input type="radio" class="nb-caixa" checked />',
    );

    expect(parseFloat(e['raio'])).toBeGreaterThan(1000);
    expect(e['fundo']).toBe(await corCalculada(page, 'var(--accent)'));
  });

  test('desabilitada, a caixa fica apagada', async ({ page }) => {
    await page.goto('/entrar');

    const e = await estilosDeUmaSonda(
      page,
      '<input type="checkbox" class="nb-caixa" disabled />',
    );

    expect(parseFloat(e['opacidade'])).toBeLessThan(1);
    expect(e['cursor']).toBe('not-allowed');
  });
});

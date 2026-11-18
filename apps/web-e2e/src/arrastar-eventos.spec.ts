/**
 * Mover e redimensionar eventos arrastando, de ponta a ponta.
 *
 * A conta (passo de 15 minutos, dias de virada, mínimo de duração) tem teste em
 * `libs/domain`, e a máquina de estados do gesto tem teste sem navegador. O que
 * só aqui se prova é a costura com o ponteiro de verdade: que arrastar grava, que
 * um clique ainda abre o formulário e um arrasto não, que Esc desiste, e que
 * arrastar uma ocorrência de série mexe só nela.
 *
 * Cada teste cria o próprio evento pela interface: os do seed são relativos a
 * "hoje" e cairiam em dias diferentes conforme o dia da semana da execução.
 */
import { test, expect, type Locator, type Page } from '@playwright/test';
import { entrar, restaurarBanco } from './apoio';

type Ponto = { readonly x: number; readonly y: number };

async function irPara(page: Page, visao: string): Promise<void> {
  const opcao = page.getByRole('radio', { name: visao });
  await opcao.click();
  await expect(opcao).toHaveAttribute('aria-checked', 'true');
}

async function criarEventoAs9h(
  page: Page,
  titulo: string,
  repeticao?: string,
): Promise<void> {
  await page.getByRole('button', { name: /^Criar evento às 9h/ }).click();
  await page.getByLabel('Título').fill(titulo);
  if (repeticao) {
    await page.getByLabel('Repetição').selectOption({ label: repeticao });
  }
  await page.getByRole('button', { name: 'Criar evento', exact: true }).click();
  await expect(faixaDe(page, titulo)).toBeVisible();
}

function faixaDe(page: Page, titulo: string): Locator {
  return page.locator('.faixa', { hasText: titulo });
}

async function caixaDe(alvo: Locator): Promise<{
  x: number;
  y: number;
  width: number;
  height: number;
}> {
  const caixa = await alvo.boundingBox();
  expect(caixa, 'O elemento não está na tela.').not.toBeNull();
  return caixa ?? { x: 0, y: 0, width: 0, height: 0 };
}

/** O centro de uma faixa, longe da alça de baixo. */
async function centroDe(faixa: Locator): Promise<Ponto> {
  await faixa.scrollIntoViewIfNeeded();
  const c = await caixaDe(faixa);
  return { x: c.x + c.width / 2, y: c.y + c.height / 2 };
}

/** Quantos pixels vale uma hora, medido na grade e não suposto. */
async function pixelsPorHora(page: Page): Promise<number> {
  return (await caixaDe(page.locator('.grade'))).height / 24;
}

async function arrastar(
  page: Page,
  de: Ponto,
  para: Ponto,
  depois?: () => Promise<void>,
): Promise<void> {
  await page.mouse.move(de.x, de.y);
  await page.mouse.down();
  await page.mouse.move(para.x, para.y, { steps: 12 });
  if (depois) {
    await depois();
  }
  await page.mouse.up();
}

/**
 * Arrasta e espera o servidor responder à gravação.
 *
 * O horário provisório aparece na hora, antes de qualquer pedido terminar.
 * Recarregar nesse intervalo abortaria a gravação em voo (numa série são dois
 * pedidos em sequência) e o teste mediria a corrida, não o produto.
 */
async function arrastarEGravar(
  page: Page,
  de: Ponto,
  para: Ponto,
): Promise<void> {
  const gravou = page.waitForResponse(
    (r) =>
      r.request().method() === 'PATCH' && r.url().includes('/api/eventos/'),
  );
  await arrastar(page, de, para);
  await gravou;
}

/**
 * A coluna ao lado e o botão que leva a ela.
 *
 * Hoje pode ser o último dia da semana: então o vizinho é o da esquerda, e para
 * ver o evento na recarga é preciso voltar um dia em vez de avançar.
 */
function vizinhaDe<T>(
  colunas: readonly T[],
  indice: number,
): { vizinha: T; botao: string } {
  const ultima = colunas.length - 1;

  return indice < ultima
    ? { vizinha: colunas[indice + 1], botao: 'Período seguinte' }
    : { vizinha: colunas[indice - 1], botao: 'Período anterior' };
}

test.describe('arrastar eventos na grade de horas', () => {
  test.beforeEach(async ({ page }) => {
    restaurarBanco();
    // Alto o bastante para a manhã inteira caber sem rolar durante o arrasto.
    await page.setViewportSize({ width: 1280, height: 1000 });
  });

  test('arrastar muda o horário, grava e não abre o formulário', async ({
    page,
  }) => {
    await entrar(page);
    await irPara(page, 'Dia');
    await criarEventoAs9h(page, 'Reunião de arrasto');

    const faixa = faixaDe(page, 'Reunião de arrasto');
    const centro = await centroDe(faixa);
    const hora = await pixelsPorHora(page);

    await arrastarEGravar(page, centro, { x: centro.x, y: centro.y + hora });

    await expect(faixa).toContainText('10:00');
    // O clique que o navegador dispara ao soltar foi engolido.
    await expect(page.getByText('Editar evento')).toHaveCount(0);

    // Gravou: sobrevive a recarregar.
    await page.reload();
    await irPara(page, 'Dia');
    await expect(faixaDe(page, 'Reunião de arrasto')).toContainText('10:00');
  });

  test('a alça de baixo muda só o fim', async ({ page }) => {
    await entrar(page);
    await irPara(page, 'Dia');
    await criarEventoAs9h(page, 'Reunião longa');

    const faixa = faixaDe(page, 'Reunião longa');
    await faixa.scrollIntoViewIfNeeded();
    const antes = await caixaDe(faixa);
    const hora = await pixelsPorHora(page);
    const alca = {
      x: antes.x + antes.width / 2,
      y: antes.y + antes.height - 3,
    };

    await arrastarEGravar(page, alca, { x: alca.x, y: alca.y + hora });

    // Começa no mesmo lugar e passa a ocupar duas horas, e não uma.
    await expect(faixa).toContainText('09:00');
    await expect
      .poll(async () => (await caixaDe(faixa)).height)
      .toBeGreaterThan(antes.height + hora - 4);

    await page.reload();
    await irPara(page, 'Dia');
    const depois = await caixaDe(faixaDe(page, 'Reunião longa'));
    expect(depois.height).toBeGreaterThan(antes.height + hora - 4);
  });

  test('um clique sem mover ainda abre o formulário', async ({ page }) => {
    await entrar(page);
    await irPara(page, 'Dia');
    await criarEventoAs9h(page, 'Só um clique');

    await faixaDe(page, 'Só um clique').click();

    await expect(page.getByText('Editar evento')).toBeVisible();
  });

  test('Esc desiste do arrasto: nada muda e nada abre', async ({ page }) => {
    await entrar(page);
    await irPara(page, 'Dia');
    await criarEventoAs9h(page, 'Desisto');

    const faixa = faixaDe(page, 'Desisto');
    const centro = await centroDe(faixa);
    const hora = await pixelsPorHora(page);

    await arrastar(page, centro, { x: centro.x, y: centro.y + hora }, () =>
      page.keyboard.press('Escape'),
    );

    await expect(faixa).toContainText('09:00');
    await expect(page.getByText('Editar evento')).toHaveCount(0);

    await page.reload();
    await irPara(page, 'Dia');
    await expect(faixaDe(page, 'Desisto')).toContainText('09:00');
  });

  test('arrastar para o lado, na semana, muda o dia', async ({ page }) => {
    await entrar(page);
    await irPara(page, 'Dia');
    await criarEventoAs9h(page, 'Troca de dia');
    await irPara(page, 'Semana');

    const faixa = faixaDe(page, 'Troca de dia');
    const centro = await centroDe(faixa);
    const colunas = await page.locator('.coluna').all();
    const caixas = await Promise.all(colunas.map((c) => caixaDe(c)));
    const indice = caixas.findIndex(
      (c) => centro.x >= c.x && centro.x < c.x + c.width,
    );
    // Hoje pode ser o último dia da semana: então o vizinho é o da esquerda.
    const { vizinha, botao } = vizinhaDe(caixas, indice);

    await arrastarEGravar(page, centro, {
      x: vizinha.x + vizinha.width / 2,
      y: centro.y,
    });

    // Fica às 9h, no dia vizinho: o gesto não mexeu no horário.
    await expect(faixa).toContainText('09:00');
    await page.reload();
    await irPara(page, 'Dia');
    await expect(faixaDe(page, 'Troca de dia')).toHaveCount(0);

    await page
      .getByRole('button', {
        name: botao,
      })
      .click();
    await expect(faixaDe(page, 'Troca de dia')).toContainText('09:00');
  });

  test('numa série, arrastar mexe só nesta ocorrência', async ({ page }) => {
    await entrar(page);
    await irPara(page, 'Dia');
    await criarEventoAs9h(page, 'Corrida', 'Todos os dias');

    const faixa = faixaDe(page, 'Corrida');
    const centro = await centroDe(faixa);
    const hora = await pixelsPorHora(page);

    await arrastarEGravar(page, centro, { x: centro.x, y: centro.y + hora });
    await expect(faixa).toContainText('10:00');

    await page.reload();
    await irPara(page, 'Dia');
    // Hoje foi para as 10h...
    await expect(faixaDe(page, 'Corrida')).toContainText('10:00');
    // ...e amanhã continua às 9h: a série não foi reescrita.
    await page.getByRole('button', { name: 'Período seguinte' }).click();
    await expect(faixaDe(page, 'Corrida')).toContainText('09:00');
  });
});

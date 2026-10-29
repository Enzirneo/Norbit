/**
 * As visões de semana e dia.
 *
 * A aritmética — onde cada faixa começa, que altura tem, com quem divide espaço,
 * e onde ficam as marcas de hora — tem 55 testes em `libs/domain`, verificados
 * por mutação. Aqui o alvo é a costura: que a visão troca, que a navegação anda
 * no tamanho certo, que o clique numa hora abre o formulário já naquele horário,
 * e que a linha de agora aparece só hoje.
 */
import { test, expect, type Page } from '@playwright/test';
import { restaurarBanco } from './apoio';

const EMAIL = 'enzo@norbit.dev';
const SENHA = 'norbit123';

async function entrar(page: Page): Promise<void> {
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill(EMAIL);
  await page.getByLabel('Senha').fill(SENHA);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

type Caixa = {
  readonly x: number;
  readonly y: number;
  readonly largura: number;
};

/** A caixa de uma faixa, já conferida — sem `?? 0` espalhado pelo teste. */
async function caixaDaFaixa(page: Page, titulo: string): Promise<Caixa> {
  const caixa = await page.locator('.faixa', { hasText: titulo }).boundingBox();

  expect(caixa, `A faixa "${titulo}" não está na tela.`).not.toBeNull();

  return {
    x: caixa?.x ?? 0,
    y: caixa?.y ?? 0,
    largura: caixa?.width ?? 0,
  };
}

/**
 * As caixas de duas faixas, da esquerda para a direita.
 *
 * Ordenar aqui — e não no teste — é o que mantém a asserção legível: sem isso o
 * teste precisa de ternários para descobrir qual é qual, e a verificação fica
 * escondida atrás da aritmética.
 */
async function duasFaixas(
  page: Page,
  primeira: string,
  segunda: string,
): Promise<readonly [Caixa, Caixa]> {
  const caixas = [
    await caixaDaFaixa(page, primeira),
    await caixaDaFaixa(page, segunda),
  ].sort((uma, outra) => uma.x - outra.x);

  const [esquerda, direita] = caixas;
  if (!esquerda || !direita) {
    throw new Error('Esperava duas faixas na tela.');
  }

  return [esquerda, direita];
}

/**
 * Avança um período e **espera o título mudar**.
 *
 * `innerText()` não tem auto-retry: lido entre dois cliques, ele devolve o
 * título de antes do segundo. Esperar a mudança é o que torna a leitura
 * confiável — e é o mesmo cuidado de `irPara`.
 */
async function avancar(page: Page): Promise<string> {
  const titulo = page.getByRole('heading', { level: 1 });
  const antes = await titulo.innerText();

  await page.getByRole('button', { name: 'Período seguinte' }).click();
  await expect(titulo).not.toHaveText(antes);

  return titulo.innerText();
}

/**
 * Troca a visão e **espera a troca acontecer**.
 *
 * Sem a espera, ler o título logo depois do clique devolve o título antigo: o
 * clique volta antes da detecção de mudanças. O `aria-checked` vem do mesmo
 * sinal que o título, então esperá-lo garante os dois.
 */
async function irPara(page: Page, visao: string): Promise<void> {
  const opcao = page.getByRole('radio', { name: visao });
  await opcao.click();
  await expect(opcao).toHaveAttribute('aria-checked', 'true');
}

test.describe('visões de semana e dia', () => {
  test.beforeEach(() => {
    restaurarBanco();
  });

  test('a visão começa no mês', async ({ page }) => {
    await entrar(page);

    await expect(page.getByRole('radio', { name: 'Mês' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(page.locator('.semana')).toHaveCount(6);
  });

  test('a semana mostra sete colunas e a grade de horas', async ({ page }) => {
    await entrar(page);
    await irPara(page, 'Semana');

    await expect(page.locator('.dia-cabecalho')).toHaveCount(7);
    // 24 horas por 7 dias de células clicáveis.
    await expect(page.locator('.celula-de-hora')).toHaveCount(168);
    // A grade de mês saiu da tela.
    await expect(page.locator('.semana')).toHaveCount(0);
  });

  test('o dia mostra uma coluna', async ({ page }) => {
    await entrar(page);
    await irPara(page, 'Dia');

    await expect(page.locator('.dia-cabecalho')).toHaveCount(1);
    await expect(page.locator('.celula-de-hora')).toHaveCount(24);
  });

  test('a linha de agora aparece hoje, e só uma vez', async ({ page }) => {
    await entrar(page);
    await irPara(page, 'Semana');

    // Uma semana tem um "hoje", então uma linha.
    await expect(page.locator('.agora')).toHaveCount(1);

    // Noutra semana não há hoje, e a linha não deve aparecer.
    await page.getByRole('button', { name: 'Período seguinte' }).click();
    await expect(page.locator('.agora')).toHaveCount(0);
  });

  test('a navegação anda no tamanho da visão', async ({ page }) => {
    await entrar(page);
    const titulo = page.getByRole('heading', { level: 1 });

    await irPara(page, 'Dia');
    const hoje = await titulo.innerText();

    await avancar(page);

    // Uma seta e volta: o mesmo dia.
    await page.getByRole('button', { name: 'Período anterior' }).click();
    await expect(titulo).toHaveText(hoje);
  });

  test('trocar de visão mantém a data', async ({ page }) => {
    // Trocar de visão não é navegar: quem está vendo o dia 20 e muda para
    // semana espera a semana do dia 20, não a de hoje.
    await entrar(page);
    await irPara(page, 'Dia');

    await avancar(page);
    const depois = await avancar(page);

    await irPara(page, 'Semana');
    await irPara(page, 'Dia');

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(depois);
  });

  test('clicar numa hora abre o formulário naquele horário', async ({
    page,
  }) => {
    await entrar(page);
    await irPara(page, 'Dia');

    await page.getByRole('button', { name: /^Criar evento às 14h/ }).click();

    await expect(
      page.getByRole('heading', { name: 'Novo evento' }),
    ).toBeVisible();
    // O palpite é uma hora de duração a partir do horário clicado.
    await expect(page.locator('input[type="time"]').first()).toHaveValue(
      '14:00',
    );
    await expect(page.locator('input[type="time"]').nth(1)).toHaveValue(
      '15:00',
    );
  });

  test('criar na grade de horas mostra a faixa na hora certa', async ({
    page,
  }) => {
    await entrar(page);
    await irPara(page, 'Dia');

    await page.getByRole('button', { name: /^Criar evento às 10h/ }).click();
    const nome = `Dentista ${Date.now().toString().slice(-6)}`;
    await page.getByLabel('Título').fill(nome);
    await page
      .getByRole('button', { name: 'Criar evento', exact: true })
      .click();

    const faixa = page.locator('.faixa', { hasText: nome });
    await expect(faixa).toBeVisible();
    await expect(faixa).toContainText('10:00');
  });

  test('eventos simultâneos ficam lado a lado', async ({ page }) => {
    // O que `distribuirColunas` resolve, valendo na tela: duas faixas no mesmo
    // horário não podem ocupar a mesma largura nem se cobrir.
    //
    // O segundo evento é criado numa hora livre e **movido** pelo formulário,
    // em vez de clicado na mesma hora: a faixa do primeiro cobre a célula das
    // 16h, e não há como clicar através dela. Isso é o comportamento esperado
    // de um calendário — não se clica "dentro" de um evento para criar outro.
    await entrar(page);
    await irPara(page, 'Dia');

    await page.getByRole('button', { name: /^Criar evento às 16h/ }).click();
    await page.getByLabel('Título').fill('Reunião A');
    await page
      .getByRole('button', { name: 'Criar evento', exact: true })
      .click();
    await expect(
      page.locator('.faixa', { hasText: 'Reunião A' }),
    ).toBeVisible();

    await page.getByRole('button', { name: /^Criar evento às 20h/ }).click();
    await page.getByLabel('Título').fill('Reunião B');
    await page.locator('input[type="time"]').first().fill('16:30');
    await page.locator('input[type="time"]').nth(1).fill('17:30');
    await page
      .getByRole('button', { name: 'Criar evento', exact: true })
      .click();
    await expect(
      page.locator('.faixa', { hasText: 'Reunião B' }),
    ).toBeVisible();

    const [esquerda, direita] = await duasFaixas(
      page,
      'Reunião A',
      'Reunião B',
    );

    // Lado a lado, sem sobreposição horizontal.
    expect(esquerda.x + esquerda.largura).toBeLessThanOrEqual(direita.x + 1);

    // E com larguras parecidas: duas faixas numa vizinhança de duas colunas.
    expect(esquerda.largura).toBeGreaterThan(0);
    expect(Math.abs(esquerda.largura - direita.largura)).toBeLessThan(2);
  });

  test('um evento de dia inteiro vai para a tira, não para a grade', async ({
    page,
  }) => {
    // Um dia inteiro não tem horário: desenhá-lo na grade de horas o faria
    // ocupar a coluna toda e esconder o resto.
    await entrar(page);
    await irPara(page, 'Dia');

    await page.getByRole('button', { name: /^Criar evento às 9h/ }).click();
    const nome = `Feriado ${Date.now().toString().slice(-6)}`;
    await page.getByLabel('Título').fill(nome);
    await page.getByText('Dia inteiro').click();
    await page
      .getByRole('button', { name: 'Criar evento', exact: true })
      .click();

    await expect(
      page.locator('.faixa-dia-inteiro', { hasText: nome }),
    ).toBeVisible();
    await expect(page.locator('.faixa', { hasText: nome })).toHaveCount(0);
  });

  test('clicar numa faixa abre a edição', async ({ page }) => {
    await entrar(page);
    await irPara(page, 'Semana');

    await page.locator('.faixa').first().click();

    await expect(
      page.getByRole('heading', { name: 'Editar evento' }),
    ).toBeVisible();
  });
});

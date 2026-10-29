/**
 * O caminho que o produto inteiro atravessa: entrar e ver a agenda.
 *
 * É o único teste que exercita as duas aplicações ao mesmo tempo, contra o
 * banco de verdade, num navegador de verdade. Tudo abaixo dele já é testado em
 * unidade — a grade de mês tem 47 testes em `libs/domain`. O que **só** aqui se
 * prova é que as peças se encontram: o login grava a sessão, o interceptor
 * manda o token, a API devolve as ocorrências, e a grade as desenha.
 *
 * Depende do `prisma db seed`: as contas e os eventos são os de
 * `prisma/seed.ts`.
 */
import { test, expect, type Page } from '@playwright/test';
import { restaurarBanco } from './apoio';

const EMAIL = 'enzo@norbit.dev';
const SENHA = 'norbit123';

/**
 * O mês em que o seed coloca os eventos.
 *
 * O seed usa datas relativas a hoje, então o teste navega para o mês atual e
 * não para um mês fixo — um mês fixo quebraria sozinho com a passagem do tempo,
 * que é o pior tipo de teste instável.
 */
function mesAtual(): string {
  const nome = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(
    new Date(),
  );
  return `${nome[0]?.toUpperCase()}${nome.slice(1)}`;
}

async function entrar(page: Page): Promise<void> {
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill(EMAIL);
  await page.getByLabel('Senha').fill(SENHA);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

test.describe('calendário', () => {
  // Cada teste parte do mesmo estado: ver `restaurarBanco`.
  test.beforeEach(() => {
    restaurarBanco();
  });

  test('entrar leva à grade do mês atual', async ({ page }) => {
    await entrar(page);

    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      mesAtual(),
    );
  });

  test('a grade mostra seis semanas de sete dias', async ({ page }) => {
    // A altura fixa é uma decisão de interface (ver docs/11) e é o que impede a
    // tela de pular ao navegar entre meses. Aqui ela é verificada no DOM.
    await entrar(page);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    await expect(page.locator('.semana')).toHaveCount(6);
    await expect(
      page.locator('.semana').first().locator('.numero'),
    ).toHaveCount(7);
  });

  test('os eventos do seed aparecem como faixas', async ({ page }) => {
    // "Academia" é a série recorrente do seed: ela é **uma linha** no banco e
    // precisa aparecer várias vezes na grade. Se a expansão não chegasse à
    // tela, apareceria uma vez só.
    await entrar(page);

    const academia = page.locator('.barra', { hasText: 'Academia' });
    await expect(academia.first()).toBeVisible();
    expect(await academia.count()).toBeGreaterThan(1);
  });

  test('a navegação entre meses troca o título e volta com "Hoje"', async ({
    page,
  }) => {
    await entrar(page);
    const titulo = page.getByRole('heading', { level: 1 });

    await expect(titulo).toContainText(mesAtual());

    await page.getByRole('button', { name: 'Período seguinte' }).click();
    await expect(titulo).not.toContainText(mesAtual());

    await page.getByRole('button', { name: 'Hoje' }).click();
    await expect(titulo).toContainText(mesAtual());
  });

  test('esconder as agendas esvazia a grade', async ({ page }) => {
    // Desmarca **todas**, em vez de uma pela qual o teste teria de saber o
    // nome: a primeira versão desmarcava "Minha órbita" e não removia nada,
    // porque os eventos do seed estão na agenda compartilhada. O teste falhava
    // sem que houvesse defeito no produto — e um teste assim ensina a duvidar
    // do produto na próxima vez que ficar vermelho.
    await entrar(page);
    await expect(page.locator('.barra').first()).toBeVisible();

    const caixas = page.getByRole('checkbox');
    for (const caixa of await caixas.all()) {
      await caixa.uncheck();
    }

    await expect(page.locator('.barra')).toHaveCount(0);
    await expect(page.getByText('Nada em órbita por aqui')).toBeVisible();
  });

  test('sem sessão, a raiz leva para a entrada', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveURL(/\/entrar/);
  });
});

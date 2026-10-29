/**
 * Criar, editar e excluir evento pela tela.
 *
 * O que só aqui se prova: que o formulário monta o corpo que a API aceita, que
 * o horário digitado chega como o instante certo, e que as três operações de
 * uma série recorrente chamam as rotas certas — "só este" são **duas**
 * chamadas, e o resultado visível é uma ocorrência diferente das outras.
 *
 * A aritmética de tempo e a montagem da RRULE já têm 44 testes em
 * `libs/domain`. Aqui o alvo é a costura.
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

/**
 * Abre o formulário clicando no espaço vazio de um dia da grade.
 *
 * Sempre o mesmo dia: `restaurarBanco` garante que cada teste começa do estado
 * do seed, então a célula não acumula faixas de testes anteriores.
 */
async function abrirDiaVazio(page: Page): Promise<void> {
  await expect(page.locator('button.fundo')).toHaveCount(42);
  // Espera a grade **com dados**: clicar enquanto as ocorrências chegam move o
  // layout sob o cursor, e o Playwright espera o alvo ficar estável até
  // estourar o tempo — com uma mensagem que só diz "timeout".
  await expect(page.locator('.barra').first()).toBeVisible();

  // Na faixa livre do rodapé da célula, e não no centro: um dia com faixas tem
  // o centro ocupado por elas. Essa faixa é garantida pelo `minmax(14px, 1fr)`
  // da última linha da grade — é o espaço que o produto reserva para que um dia
  // cheio continue clicável.
  const dia = page.locator('button.fundo').nth(10);
  const caixa = await dia.boundingBox();
  await dia.click({
    position: { x: 10, y: Math.max((caixa?.height ?? 40) - 7, 4) },
  });

  await expect(
    page.getByRole('heading', { name: 'Novo evento' }),
  ).toBeVisible();
}

/** Um título único por execução, para os testes não interferirem entre si. */
function titulo(prefixo: string): string {
  return `${prefixo} ${Date.now().toString().slice(-6)}`;
}

test.describe('formulário de evento', () => {
  // Cada teste parte do mesmo estado: ver `restaurarBanco`.
  test.beforeEach(() => {
    restaurarBanco();
  });

  test('criar um evento o faz aparecer na grade', async ({ page }) => {
    await entrar(page);
    await abrirDiaVazio(page);

    const nome = titulo('Dentista');
    await page.getByLabel('Título').fill(nome);
    await page
      .getByRole('button', { name: 'Criar evento', exact: true })
      .click();

    await expect(page.locator('.barra', { hasText: nome })).toBeVisible();
  });

  test('o horário digitado é o horário que aparece', async ({ page }) => {
    // O defeito que este teste pega é o clássico "marquei 9h e salvou 6h": o
    // texto do `<input type="time">` não tem fuso, e interpretá-lo no fuso
    // errado desloca o evento.
    await entrar(page);
    await abrirDiaVazio(page);

    const nome = titulo('Reunião');
    await page.getByLabel('Título').fill(nome);
    await page.getByLabel('Início').getByRole('textbox').nth(0).isVisible();
    await page.locator('input[type="time"]').first().fill('14:30');
    await page.locator('input[type="time"]').nth(1).fill('15:30');
    await page
      .getByRole('button', { name: 'Criar evento', exact: true })
      .click();

    const barra = page.locator('.barra', { hasText: nome });
    await expect(barra).toBeVisible();
    await expect(barra).toContainText('14:30');
  });

  test('dia inteiro esconde os campos de hora', async ({ page }) => {
    await entrar(page);
    await abrirDiaVazio(page);

    await expect(page.locator('input[type="time"]').first()).toBeVisible();
    await page.getByText('Dia inteiro').click();

    await expect(page.locator('input[type="time"]')).toHaveCount(0);
  });

  test('editar um evento abre o formulário preenchido', async ({ page }) => {
    await entrar(page);
    await abrirDiaVazio(page);

    const nome = titulo('Almoço');
    await page.getByLabel('Título').fill(nome);
    await page
      .getByRole('button', { name: 'Criar evento', exact: true })
      .click();
    await expect(page.locator('.barra', { hasText: nome })).toBeVisible();

    await page.locator('.barra', { hasText: nome }).click();

    await expect(
      page.getByRole('heading', { name: 'Editar evento' }),
    ).toBeVisible();
    await expect(page.getByLabel('Título')).toHaveValue(nome);
  });

  test('salvar uma alteração troca o que a grade mostra', async ({ page }) => {
    await entrar(page);
    await abrirDiaVazio(page);

    const antes = titulo('Antes');
    const depois = titulo('Depois');
    await page.getByLabel('Título').fill(antes);
    await page
      .getByRole('button', { name: 'Criar evento', exact: true })
      .click();
    await expect(page.locator('.barra', { hasText: antes })).toBeVisible();

    await page.locator('.barra', { hasText: antes }).click();
    await page.getByLabel('Título').fill(depois);
    await page.getByRole('button', { name: 'Salvar' }).click();

    await expect(page.locator('.barra', { hasText: depois })).toBeVisible();
    await expect(page.locator('.barra', { hasText: antes })).toHaveCount(0);
  });

  test('excluir pede confirmação antes de apagar', async ({ page }) => {
    await entrar(page);
    await abrirDiaVazio(page);

    const nome = titulo('Temporário');
    await page.getByLabel('Título').fill(nome);
    await page
      .getByRole('button', { name: 'Criar evento', exact: true })
      .click();
    await expect(page.locator('.barra', { hasText: nome })).toBeVisible();

    await page.locator('.barra', { hasText: nome }).click();
    await page.getByRole('button', { name: 'Excluir' }).click();

    // O primeiro clique não apaga: numa série, o que ele apagaria depende do
    // escopo escolhido, e isso é informação demais para um clique só.
    await expect(
      page.getByRole('button', { name: 'Confirmar exclusão' }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Confirmar exclusão' }).click();
    await expect(page.locator('.barra', { hasText: nome })).toHaveCount(0);
  });

  test('cancelar fecha sem gravar', async ({ page }) => {
    await entrar(page);
    await abrirDiaVazio(page);

    const nome = titulo('Descartado');
    await page.getByLabel('Título').fill(nome);
    await page.getByRole('button', { name: 'Cancelar' }).click();

    await expect(
      page.getByRole('heading', { name: 'Novo evento' }),
    ).toHaveCount(0);
    await expect(page.locator('.barra', { hasText: nome })).toHaveCount(0);
  });

  test.describe('uma série recorrente', () => {
    /**
     * Cria uma série semanal própria, em vez de usar a do seed.
     *
     * Os testes abaixo **alteram** e **apagam** ocorrências. Mexer na série do
     * seed deixaria o banco diferente para quem rodar depois, e um teste que
     * depende da ordem de execução falha sozinho mais tarde, por um motivo que
     * não aparece no código dele.
     */
    async function criarSerieSemanal(page: Page): Promise<string> {
      await abrirDiaVazio(page);

      const nome = titulo('Pilates');
      await page.getByLabel('Título').fill(nome);
      await page.getByLabel('Repetição').selectOption('semanal');
      // Segunda e quarta: garante mais de uma ocorrência no mês.
      // Pelo escopo do `fieldset`: "Seg" e "Qua" também são os nomes das
      // colunas da grade, atrás do diálogo.
      const seletorDeDias = page.getByRole('group', { name: 'Nos dias' });
      await seletorDeDias.getByText('Seg', { exact: true }).click();
      await seletorDeDias.getByText('Qua', { exact: true }).click();
      await page
        .getByRole('button', { name: 'Criar evento', exact: true })
        .click();

      await expect(
        page.locator('.barra', { hasText: nome }).first(),
      ).toBeVisible();
      return nome;
    }

    test('nasce com várias ocorrências de uma linha só', async ({ page }) => {
      await entrar(page);
      const nome = await criarSerieSemanal(page);

      // Uma linha no banco, várias barras na tela: é a expansão funcionando do
      // formulário até o desenho.
      expect(
        await page.locator('.barra', { hasText: nome }).count(),
      ).toBeGreaterThan(1);
    });

    test('oferece a escolha entre esta ocorrência e todas', async ({
      page,
    }) => {
      await entrar(page);
      const nome = await criarSerieSemanal(page);

      await page.locator('.barra', { hasText: nome }).first().click();

      await expect(page.getByText('Somente este evento')).toBeVisible();
      await expect(page.getByText('Todos os eventos da série')).toBeVisible();
      // O seletor reconhece a regra que ele mesmo montou — a ida e volta de
      // `montarRrule`/`lerRepeticao` valendo na tela.
      await expect(page.getByLabel('Repetição')).toHaveValue('semanal');
    });

    test('um evento avulso não oferece a escolha', async ({ page }) => {
      await entrar(page);
      await abrirDiaVazio(page);

      const nome = titulo('Avulso');
      await page.getByLabel('Título').fill(nome);
      await page
        .getByRole('button', { name: 'Criar evento', exact: true })
        .click();
      await expect(page.locator('.barra', { hasText: nome })).toBeVisible();

      await page.locator('.barra', { hasText: nome }).click();

      await expect(page.getByText('Somente este evento')).toHaveCount(0);
    });

    test('editar só esta altera uma ocorrência e deixa as outras', async ({
      page,
    }) => {
      // A operação que exige duas chamadas: destacar cria a linha filha, e a
      // alteração é dela. O resultado visível é uma ocorrência com outro título
      // no meio de uma série intacta — e **nenhuma** duplicada.
      await entrar(page);
      const nome = await criarSerieSemanal(page);
      const antes = await page.locator('.barra', { hasText: nome }).count();

      await page.locator('.barra', { hasText: nome }).first().click();
      await page.getByText('Somente este evento').click();
      const novo = `${nome} adiada`;
      await page.getByLabel('Título').fill(novo);
      await page.getByRole('button', { name: 'Salvar' }).click();

      await expect(page.locator('.barra', { hasText: novo })).toHaveCount(1);
      // O total não mudou: a instância original foi **suprimida** pela filha,
      // não somada a ela. Se o número subisse, o evento estaria duplicado.
      await expect(page.locator('.barra', { hasText: nome })).toHaveCount(
        antes,
      );
    });

    test('editar todas altera a série inteira', async ({ page }) => {
      await entrar(page);
      const nome = await criarSerieSemanal(page);
      const antes = await page.locator('.barra', { hasText: nome }).count();

      await page.locator('.barra', { hasText: nome }).first().click();
      await page.getByText('Todos os eventos da série').click();
      const novo = `${nome} remarcada`;
      await page.getByLabel('Título').fill(novo);
      await page.getByRole('button', { name: 'Salvar' }).click();

      await expect(page.locator('.barra', { hasText: novo })).toHaveCount(
        antes,
      );
    });

    test('excluir só esta tira uma ocorrência e mantém a série', async ({
      page,
    }) => {
      await entrar(page);
      const nome = await criarSerieSemanal(page);
      const antes = await page.locator('.barra', { hasText: nome }).count();

      await page.locator('.barra', { hasText: nome }).first().click();
      await page.getByText('Somente este evento').click();
      await page.getByRole('button', { name: 'Excluir' }).click();
      await page.getByRole('button', { name: 'Confirmar exclusão' }).click();

      await expect(page.locator('.barra', { hasText: nome })).toHaveCount(
        antes - 1,
      );
    });

    test('excluir todas tira a série inteira', async ({ page }) => {
      await entrar(page);
      const nome = await criarSerieSemanal(page);

      await page.locator('.barra', { hasText: nome }).first().click();
      await page.getByText('Todos os eventos da série').click();
      await page.getByRole('button', { name: 'Excluir' }).click();
      await page.getByRole('button', { name: 'Confirmar exclusão' }).click();

      await expect(page.locator('.barra', { hasText: nome })).toHaveCount(0);
    });
  });
});

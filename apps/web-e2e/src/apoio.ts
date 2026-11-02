/**
 * Apoio dos testes de ponta a ponta.
 *
 * Não é um arquivo de teste: `.ts` sem `.spec` fica fora do `testMatch`.
 */
import { execFileSync } from 'node:child_process';
import { workspaceRoot } from '@nx/devkit';

/**
 * Devolve o banco ao estado do seed.
 *
 * Chamado antes de **cada** teste. Sem isso os testes se contaminam de um jeito
 * particularmente traiçoeiro: cada um que cria uma série semanal deixa faixas
 * nas mesmas colunas, as células enchem as três trilhas, e as faixas do teste
 * seguinte passam a ficar escondidas atrás do "+N" — o teste falha dizendo que
 * não encontrou o que ele mesmo acabou de criar.
 *
 * O seed apaga e recria as contas de desenvolvimento, e os eventos vão com elas
 * por cascata. Custa cerca de um segundo por teste, e compra a propriedade que
 * importa numa suíte que escreve no banco: a ordem de execução não altera o
 * resultado.
 */
export function restaurarBanco(): void {
  execFileSync('npm', ['run', 'db:seed'], {
    cwd: workspaceRoot,
    stdio: 'ignore',
    shell: true,
  });
}

/**
 * Entra pela interface e **espera o login terminar**.
 *
 * A espera é pela saída da página de entrada, e não por um `<h1>`: a própria
 * página de login tem um `<h1>Entrar</h1>`, então esperar "um título de nível 1"
 * passa na hora, antes de o login terminar. O teste seguinte que navegasse logo
 * depois abortava a requisição em voo — sem cookie, sem sessão, e a página
 * voltava para `/entrar`.
 *
 * Esteve duplicado em cada spec, cada cópia com o mesmo defeito, e só apareceu
 * quando o primeiro teste que recarrega a página foi escrito.
 */
export async function entrar(
  page: import('@playwright/test').Page,
  credenciais: { email: string; senha: string } = {
    email: 'enzo@norbit.dev',
    senha: 'norbit123',
  },
): Promise<void> {
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill(credenciais.email);
  await page.getByLabel('Senha').fill(credenciais.senha);
  await page.getByRole('button', { name: 'Entrar' }).click();

  await page.waitForURL((url) => !url.pathname.startsWith('/entrar'));
  await page.getByRole('heading', { level: 1 }).waitFor();
}

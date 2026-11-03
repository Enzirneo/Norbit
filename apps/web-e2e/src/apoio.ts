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

const MAILPIT = `http://localhost:${process.env['MAILPIT_UI_PORT'] ?? '8025'}`;

type ResumoDeEmail = { ID: string; To: { Address: string }[] };

/** Esvazia a caixa do Mailpit, para o teste só ver o que ele mesmo provocou. */
export async function esvaziarCaixa(): Promise<void> {
  await fetch(`${MAILPIT}/api/v1/messages`, { method: 'DELETE' });
}

/**
 * O texto do e-mail que chegou para o endereço, esperando se preciso.
 *
 * O envio não é aguardado pela API (de propósito), então o e-mail chega
 * depois da resposta. Espera por polling, e devolve `null` se nada chegou no
 * prazo — o que é a asserção, para o teste de "não chega nada".
 */
export async function esperarEmail(
  para: string,
  prazoEmMs = 5_000,
): Promise<string | null> {
  const limite = Date.now() + prazoEmMs;

  while (Date.now() < limite) {
    const resposta = await fetch(`${MAILPIT}/api/v1/messages`);
    const corpo = (await resposta.json()) as { messages: ResumoDeEmail[] };
    const achado = corpo.messages.find((m) =>
      m.To.some((destino) => destino.Address === para),
    );

    if (achado) {
      const completo = await fetch(`${MAILPIT}/api/v1/message/${achado.ID}`);
      return ((await completo.json()) as { Text: string }).Text;
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  return null;
}

/** O link de redefinição que está no texto do e-mail. */
export function linkDoEmail(texto: string): string {
  const achado = /https?:\/\/\S+\/redefinir-senha\?token=\S+/.exec(texto);
  if (!achado) {
    throw new Error('O e-mail não traz o link de redefinição.');
  }
  return achado[0];
}

/** O link de convite que está no texto do e-mail. */
export function linkDoConviteNoEmail(texto: string): string {
  const achado = /https?:\/\/\S+\/convite\?token=\S+/.exec(texto);
  if (!achado) {
    throw new Error('O e-mail não traz o link do convite.');
  }
  return achado[0];
}

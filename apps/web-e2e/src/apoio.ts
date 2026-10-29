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

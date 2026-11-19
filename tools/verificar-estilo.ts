/**
 * Varre o app web atrás de cor literal e raio em pixel fora dos tokens.
 *
 * As regras e as exceções moram em `libs/design-tokens/src/lib/guarda-de-estilo.ts`,
 * com teste. Este arquivo só percorre as pastas, aplica a guarda e devolve o
 * resultado ao CI: código de saída 1 se achou alguma violação.
 *
 * Uso: npm run estilo:verificar
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  acharViolacoes,
  deveVerificar,
  type Violacao,
} from '../libs/design-tokens/src';

const RAIZ = process.cwd();
const PASTA_DO_APP = join(RAIZ, 'apps', 'web', 'src');

function arquivosDe(pasta: string): string[] {
  return readdirSync(pasta).flatMap((nome) => {
    const caminho = join(pasta, nome);
    return statSync(caminho).isDirectory() ? arquivosDe(caminho) : [caminho];
  });
}

const violacoes: Violacao[] = arquivosDe(PASTA_DO_APP)
  .map((arquivo) => relative(RAIZ, arquivo).replaceAll('\\', '/'))
  .filter(deveVerificar)
  .flatMap((caminho) =>
    acharViolacoes({
      caminho,
      conteudo: readFileSync(join(RAIZ, caminho), 'utf8'),
    }),
  );

if (violacoes.length === 0) {
  console.log('estilo: nenhuma cor literal nem raio em pixel fora dos tokens.');
} else {
  for (const v of violacoes) {
    console.error(`${v.caminho}:${v.linha}  [${v.regra}]  ${v.mensagem}`);
    console.error(`    ${v.trecho}`);
  }
  console.error(
    `\nestilo: ${violacoes.length} violação(ões). Para uma exceção justificada, ` +
      'comente `estilo-literal: <motivo>` na linha ou acima dela.',
  );
  process.exit(1);
}

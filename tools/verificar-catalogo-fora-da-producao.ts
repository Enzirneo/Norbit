/**
 * Garante que o catálogo `/design` não foi para o pacote de produção.
 *
 * O catálogo é dev-only (ver `apps/web/src/app/design/rotas-do-catalogo.ts`) e
 * some do bundle porque a constante de build `CATALOGO` é falsa na produção.
 * Esta conferência procura, no `dist`, o seletor e o título do catálogo: se a
 * constante for trocada ou o `define` sair do `project.json`, ela reprova.
 *
 * Uso: depois de `nx build web`, `npm run catalogo:verificar`.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const PASTA = join(process.cwd(), 'dist', 'apps', 'web', 'browser');
const MARCAS = ['nb-catalogo', 'Catálogo de design'];

function arquivos(pasta: string): string[] {
  return readdirSync(pasta).flatMap((nome) => {
    const caminho = join(pasta, nome);
    return statSync(caminho).isDirectory() ? arquivos(caminho) : [caminho];
  });
}

const achados = arquivos(PASTA)
  .filter((a) => /\.(js|html)$/.test(a))
  .filter((a) => MARCAS.some((m) => readFileSync(a, 'utf8').includes(m)));

if (achados.length > 0) {
  console.error('O catálogo de design foi parar no build de produção:');
  achados.forEach((a) => console.error(`  ${a}`));
  process.exit(1);
}

console.log('catálogo: fora do pacote de produção.');

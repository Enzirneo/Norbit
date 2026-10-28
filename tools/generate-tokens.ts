/**
 * Gera o CSS dos tokens a partir da fonte TypeScript em libs/design-tokens.
 *
 * Existe para que os valores vivam em UM lugar só: o TS alimenta tanto o
 * código da aplicação quanto o CSS que o Tailwind e os componentes consomem.
 * Escrever as duas cópias à mão seria garantir que divergissem.
 *
 * Uso: npm run tokens:build
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { primitives, toCssVariables } from '../libs/design-tokens/src';

const AVISO = [
  '/* ARQUIVO GERADO — NÃO EDITE À MÃO.',
  '   Fonte: libs/design-tokens/src/lib/primitives.ts',
  '   Regerar: npm run tokens:build */',
].join('\n');

const camadas = primitives
  .map(({ prefix, tokens }) =>
    toCssVariables(tokens, prefix)
      .split('\n')
      .map((linha) => `  ${linha}`)
      .join('\n'),
  )
  .join('\n\n');

// @theme expõe os tokens ao Tailwind 4, que passa a gerar utilitários a partir
// deles (bg-nebula, duration-base) além de deixá-los como variáveis CSS.
const css = `${AVISO}\n\n@theme {\n${camadas}\n}\n`;

const destino = join(process.cwd(), 'apps', 'web', 'src', 'tokens.generated.css');
writeFileSync(destino, css, 'utf8');
console.log(`tokens gerados: ${destino}`);

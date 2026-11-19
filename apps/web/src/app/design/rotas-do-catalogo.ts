/**
 * A rota `/design`, que só existe em desenvolvimento.
 *
 * `CATALOGO` é uma constante de build (`define` no `project.json`): `true` no
 * desenvolvimento e `false` na produção. Com ela falsa, o bundler elimina o
 * `import()` junto, e o catálogo **não vai para o pacote de produção**; o
 * script `tools/verificar-catalogo-fora-da-producao.ts` confere isso no `dist`.
 * Sem a constante (nos testes de unidade), a rota não existe.
 */
import type { Route } from '@angular/router';

declare const CATALOGO: boolean | undefined;

export function rotasDoCatalogo(): Route[] {
  return typeof CATALOGO !== 'undefined' && CATALOGO
    ? [
        {
          path: 'design',
          loadComponent: () => import('./catalogo').then((m) => m.Catalogo),
        },
      ]
    : [];
}

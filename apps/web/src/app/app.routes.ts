import { Route } from '@angular/router';
import { exigeSessao, exigeVisitante } from './auth/auth.guard';

export const appRoutes: Route[] = [
  {
    path: '',
    canActivate: [exigeSessao],
    loadComponent: () => import('./paginas/inicio').then((m) => m.Inicio),
  },
  {
    path: 'entrar',
    canActivate: [exigeVisitante],
    loadComponent: () => import('./auth/paginas/entrar').then((m) => m.Entrar),
  },
  {
    path: 'criar-conta',
    canActivate: [exigeVisitante],
    loadComponent: () =>
      import('./auth/paginas/criar-conta').then((m) => m.CriarConta),
  },
  // Qualquer outro caminho cai na raiz, e o guard decide se é login ou início.
  { path: '**', redirectTo: '' },
];

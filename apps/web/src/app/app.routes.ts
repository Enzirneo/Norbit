import { Route } from '@angular/router';
import { exigeSessao, exigeVisitante } from './auth/auth.guard';

export const appRoutes: Route[] = [
  {
    path: '',
    canActivate: [exigeSessao],
    loadComponent: () =>
      import('./calendario/paginas/calendario').then((m) => m.Calendario),
  },
  {
    path: 'preferencias',
    canActivate: [exigeSessao],
    loadComponent: () =>
      import('./preferencias/paginas/preferencias').then((m) => m.Preferencias),
  },
  {
    path: 'perfil',
    canActivate: [exigeSessao],
    loadComponent: () =>
      import('./perfil/paginas/perfil').then((m) => m.Perfil),
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
  {
    path: 'esqueci-senha',
    canActivate: [exigeVisitante],
    loadComponent: () =>
      import('./auth/paginas/esqueci-senha').then((m) => m.EsqueciSenha),
  },
  // Sem `exigeVisitante`: quem segue o link do e-mail pode estar com outra
  // conta aberta neste navegador, e ser mandado de volta ao calendário
  // esconderia a tela que veio buscar.
  {
    path: 'redefinir-senha',
    loadComponent: () =>
      import('./auth/paginas/redefinir-senha').then((m) => m.RedefinirSenha),
  },
  // Qualquer outro caminho cai na raiz, e o guard decide se é login ou início.
  { path: '**', redirectTo: '' },
];

/**
 * Guardas de rota.
 *
 * Nenhuma das duas consulta o servidor: a sessão já foi restaurada antes do
 * roteamento, por `provideAppInitializer` em `app.config.ts`. É isso que faz um
 * link direto para uma página interna funcionar numa aba nova — sem o
 * inicializador, o guard veria "não autenticado" e jogaria todo mundo para o
 * login a cada recarga.
 *
 * E a guarda aqui é de navegação, não de segurança: quem decide o que cada
 * pessoa pode ver é a API. Isto evita mostrar uma tela que vai falhar.
 */
import { inject } from '@angular/core';
import { Router, type CanActivateFn, type UrlTree } from '@angular/router';
import { AuthService } from './auth.service';

/** Exige sessão. Sem ela, manda para o login guardando o destino. */
export const exigeSessao: CanActivateFn = (
  _rota,
  estado,
): boolean | UrlTree => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.autenticado()) {
    return true;
  }

  // `voltarPara` para que a pessoa chegue onde queria depois de entrar, em vez
  // de cair sempre na página inicial.
  return router.createUrlTree(['/entrar'], {
    queryParams: { voltarPara: estado.url },
  });
};

/** O contrário: quem já entrou não precisa ver login nem cadastro. */
export const exigeVisitante: CanActivateFn = (): boolean | UrlTree => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.autenticado() ? router.createUrlTree(['/']) : true;
};

import {
  provideHttpClient,
  withFetch,
  withInterceptors,
} from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { appRoutes } from './app.routes';
import { authInterceptor } from './auth/auth.interceptor';
import { AuthService } from './auth/auth.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    // Tenta restaurar a sessão **antes** de o roteamento acontecer. Sem isto,
    // o guard veria "não autenticado" a cada recarga e jogaria a pessoa para o
    // login mesmo com o cookie válido — e um link direto para uma página
    // interna nunca funcionaria numa aba nova.
    provideAppInitializer(() => inject(AuthService).restaurarSessao()),
  ],
};

/**
 * Renovação transparente do access token.
 *
 * A tela não sabe que o token expirou: a requisição que falhou com 401 é
 * repetida com o token novo, e o componente recebe a resposta certa como se
 * nada tivesse acontecido.
 */
import {
  HttpErrorResponse,
  type HttpEvent,
  type HttpHandlerFn,
  type HttpInterceptorFn,
  type HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, catchError, switchMap, throwError } from 'rxjs';
import { AuthService, ROTAS_DA_API } from './auth.service';

/** As rotas que se autenticam pelo cookie, não pelo cabeçalho. */
const ROTAS_SEM_TOKEN: readonly string[] = [
  ROTAS_DA_API.cadastro,
  ROTAS_DA_API.login,
  ROTAS_DA_API.refresh,
  ROTAS_DA_API.logout,
];

export const authInterceptor: HttpInterceptorFn = (requisicao, proximo) => {
  const auth = inject(AuthService);

  // Só a nossa API: mandar o token do Norbit para outro domínio seria
  // entregá-lo de graça a quem quer que atenda aquela URL.
  if (!ehDaNossaApi(requisicao.url)) {
    return proximo(requisicao);
  }

  const ehRotaDeAuth = ROTAS_SEM_TOKEN.includes(requisicao.url);

  return proximo(
    comToken(requisicao, ehRotaDeAuth ? null : auth.tokenAtual()),
  ).pipe(
    catchError((erro: unknown) => {
      // `ehRotaDeAuth` é a guarda contra o laço: sem ela, um refresh recusado
      // dispararia outro refresh, e isso só terminaria com a pilha cheia.
      if (!ehExpirado(erro) || ehRotaDeAuth) {
        return throwError(() => erro);
      }

      return renovarERepetir(auth, requisicao, proximo);
    }),
  );
};

function renovarERepetir(
  auth: AuthService,
  requisicao: HttpRequest<unknown>,
  proximo: HttpHandlerFn,
): Observable<HttpEvent<unknown>> {
  // `renovar` compartilha a requisição em curso: dez 401 simultâneos geram uma
  // renovação, não dez. E, se ela falhar, é ele quem limpa a sessão — aqui o
  // erro só precisa chegar ao chamador. Ver o comentário em
  // AuthService.renovar.
  return auth
    .renovar()
    .pipe(switchMap((token) => proximo(comToken(requisicao, token))));
}

function comToken(
  requisicao: HttpRequest<unknown>,
  token: string | null,
): HttpRequest<unknown> {
  if (!token) {
    return requisicao;
  }

  return requisicao.clone({
    setHeaders: { Authorization: `Bearer ${token}` },
  });
}

/**
 * Requisição para a própria API.
 *
 * Em desenvolvimento o dev server faz proxy de `/api` para a api, então tudo
 * sai como caminho relativo — mesma origem, sem CORS e sem complicação de
 * cookie. Um caminho absoluto para outro host nunca é nosso.
 */
function ehDaNossaApi(url: string): boolean {
  return url.startsWith('/api/');
}

function ehExpirado(erro: unknown): boolean {
  return erro instanceof HttpErrorResponse && erro.status === 401;
}

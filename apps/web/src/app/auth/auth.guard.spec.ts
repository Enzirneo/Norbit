import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, type UrlTree } from '@angular/router';
import { exigeSessao, exigeVisitante } from './auth.guard';
import { AuthService, ROTAS_DA_API } from './auth.service';

const USUARIO = {
  id: '01a18471-9684-7755-a2fa-8fc0b6bb6d83',
  email: 'demo@norbit.dev',
  handle: 'demo',
  displayName: 'Demo',
  avatarUrl: null,
  timeZone: 'America/Sao_Paulo',
};

/** O guard recebe o estado da rota; só o `url` importa para estas regras. */
const ESTADO = { url: '/agendas/minhas' } as never;
const ROTA = {} as never;

describe('guardas de autenticação', () => {
  let auth: AuthService;
  let router: Router;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });

    auth = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  function entrar(): void {
    auth.entrar({ email: USUARIO.email, password: 'x'.repeat(12) }).subscribe();
    httpMock
      .expectOne(ROTAS_DA_API.login)
      .flush({ accessToken: 'token', usuario: USUARIO });
  }

  describe('exigeSessao', () => {
    it('libera quem tem sessão', () => {
      entrar();

      expect(
        TestBed.runInInjectionContext(() => exigeSessao(ROTA, ESTADO)),
      ).toBe(true);
    });

    it('manda para o login quem não tem', () => {
      const resultado = TestBed.runInInjectionContext(() =>
        exigeSessao(ROTA, ESTADO),
      );

      expect(router.serializeUrl(resultado as UrlTree)).toBe(
        '/entrar?voltarPara=%2Fagendas%2Fminhas',
      );
    });

    it('guarda o destino para depois do login', () => {
      // Sem isto, quem abre um link de evento recebido por mensagem entra e cai
      // na página inicial, tendo de procurar o evento de novo.
      const resultado = TestBed.runInInjectionContext(() =>
        exigeSessao(ROTA, { url: '/eventos/123' } as never),
      );

      expect(
        router.serializeUrl(resultado as UrlTree).includes('%2Feventos%2F123'),
      ).toBe(true);
    });
  });

  describe('exigeVisitante', () => {
    it('libera quem não tem sessão', () => {
      expect(
        TestBed.runInInjectionContext(() => exigeVisitante(ROTA, ESTADO)),
      ).toBe(true);
    });

    it('tira de lá quem já entrou', () => {
      entrar();

      const resultado = TestBed.runInInjectionContext(() =>
        exigeVisitante(ROTA, ESTADO),
      );

      expect(router.serializeUrl(resultado as UrlTree)).toBe('/');
    });
  });
});

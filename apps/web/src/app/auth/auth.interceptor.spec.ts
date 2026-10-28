/**
 * O interceptor é onde a renovação transparente acontece, e tem uma armadilha
 * que só aparece sob concorrência: várias requisições recebendo 401 ao mesmo
 * tempo.
 *
 * Como cada refresh é de uso único e rotaciona, duas renovações simultâneas
 * fariam a segunda apresentar um token já revogado — e a aplicação acionaria a
 * detecção de reúso do servidor contra si mesma, derrubando a sessão de quem
 * não fez nada de errado. O teste de "uma só renovação" existe por isso.
 */
import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { authInterceptor } from './auth.interceptor';
import { AuthService, ROTAS_DA_API } from './auth.service';

const USUARIO = {
  id: '01a18471-9684-7755-a2fa-8fc0b6bb6d83',
  email: 'demo@norbit.dev',
  handle: 'demo',
  displayName: 'Demo',
  avatarUrl: null,
  timeZone: 'America/Sao_Paulo',
};

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let auth: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
  });

  afterEach(() => {
    httpMock.verify();
  });

  /** Coloca a sessão de pé pelo caminho normal, via login. */
  function entrar(token = 'token-inicial'): void {
    auth.entrar({ email: USUARIO.email, password: 'x'.repeat(12) }).subscribe();
    httpMock
      .expectOne(ROTAS_DA_API.login)
      .flush({ accessToken: token, usuario: USUARIO });
  }

  it('não manda cabeçalho de autorização quando não há sessão', () => {
    http.get('/api/agendas').subscribe();

    const req = httpMock.expectOne('/api/agendas');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('anexa o token às requisições da API', () => {
    entrar('token-abc');

    http.get('/api/agendas').subscribe();

    const req = httpMock.expectOne('/api/agendas');
    expect(req.request.headers.get('Authorization')).toBe('Bearer token-abc');
    req.flush({});
  });

  it('não anexa o token às próprias rotas de autenticação', () => {
    entrar();

    // O refresh se autentica pelo cookie. Mandar um access token expirado
    // junto não ajuda, e confunde quem lê o log do servidor.
    auth.renovar().subscribe();

    const req = httpMock.expectOne(ROTAS_DA_API.refresh);
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({ accessToken: 'novo', usuario: USUARIO });
  });

  it('renova e repete a requisição quando o token expirou', () => {
    entrar('token-velho');

    let corpoRecebido: unknown = null;
    http.get('/api/agendas').subscribe((corpo) => (corpoRecebido = corpo));

    // A primeira tentativa leva o token velho e é recusada.
    httpMock
      .expectOne(
        (r) =>
          r.url === '/api/agendas' &&
          r.headers.get('Authorization') === 'Bearer token-velho',
      )
      .flush(null, { status: 401, statusText: 'Unauthorized' });

    // O interceptor renova sozinho.
    httpMock
      .expectOne(ROTAS_DA_API.refresh)
      .flush({ accessToken: 'token-novo', usuario: USUARIO });

    // E repete com o token novo, sem que a tela tenha sabido de nada.
    httpMock
      .expectOne(
        (r) =>
          r.url === '/api/agendas' &&
          r.headers.get('Authorization') === 'Bearer token-novo',
      )
      .flush({ agendas: [] });

    expect(corpoRecebido).toEqual({ agendas: [] });
  });

  it('renova uma única vez para várias requisições que falham juntas', () => {
    entrar('token-velho');

    http.get('/api/agendas').subscribe();
    http.get('/api/eventos').subscribe();
    http.get('/api/tarefas').subscribe();

    for (const url of ['/api/agendas', '/api/eventos', '/api/tarefas']) {
      httpMock
        .expectOne(url)
        .flush(null, { status: 401, statusText: 'Unauthorized' });
    }

    // O ponto do teste: uma renovação, não três. `expectOne` falha se houver
    // mais de uma.
    httpMock
      .expectOne(ROTAS_DA_API.refresh)
      .flush({ accessToken: 'token-novo', usuario: USUARIO });

    for (const url of ['/api/agendas', '/api/eventos', '/api/tarefas']) {
      httpMock
        .expectOne(
          (r) =>
            r.url === url &&
            r.headers.get('Authorization') === 'Bearer token-novo',
        )
        .flush({});
    }
  });

  it('não tenta renovar quando é a própria renovação que falha', () => {
    entrar();

    let falhou = false;
    auth.renovar().subscribe({ error: () => (falhou = true) });

    httpMock
      .expectOne(ROTAS_DA_API.refresh)
      .flush(null, { status: 401, statusText: 'Unauthorized' });

    // Sem esta guarda, um refresh recusado dispararia outro refresh, e o laço
    // só terminaria com a pilha cheia.
    expect(falhou).toBe(true);
    expect(auth.autenticado()).toBe(false);
  });

  it('encerra a sessão local quando a renovação é recusada', () => {
    entrar('token-velho');

    let erro: unknown = null;
    http.get('/api/agendas').subscribe({ error: (e: unknown) => (erro = e) });

    httpMock
      .expectOne('/api/agendas')
      .flush(null, { status: 401, statusText: 'Unauthorized' });
    httpMock
      .expectOne(ROTAS_DA_API.refresh)
      .flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(erro).not.toBeNull();
    expect(auth.autenticado()).toBe(false);
  });

  it('deixa passar o erro quando não é 401', () => {
    entrar();

    let status: number | null = null;
    http.get('/api/agendas').subscribe({
      error: (e: { status: number }) => (status = e.status),
    });

    httpMock
      .expectOne('/api/agendas')
      .flush(null, { status: 500, statusText: 'Erro' });

    // 500 não é problema de token: renovar não resolveria e esconderia a causa.
    expect(status).toBe(500);
  });

  it('ignora requisições que não são para a nossa API', () => {
    entrar('token-abc');

    http.get('https://exemplo.com/dados').subscribe();

    const req = httpMock.expectOne('https://exemplo.com/dados');
    // Mandar o token do Norbit para outro domínio seria entregá-lo de graça.
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });
});

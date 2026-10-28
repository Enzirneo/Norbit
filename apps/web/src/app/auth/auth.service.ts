/**
 * O estado de autenticação do cliente.
 *
 * O access token vive **só em memória**, num campo privado: nem `localStorage`
 * nem `sessionStorage`. Qualquer um dos dois é legível por JavaScript, e aí um
 * XSS leva o token embora. O que sobrevive a recarregar a página é o cookie
 * `httpOnly` do refresh, que o script não alcança — por isso `restaurarSessao`
 * troca o cookie por um token novo na subida, em vez de ler um token guardado.
 */
import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import type { Cadastro, Login, UsuarioAutenticado } from '@norbit/contracts';
import {
  Observable,
  catchError,
  finalize,
  of,
  shareReplay,
  tap,
  throwError,
} from 'rxjs';
import { map } from 'rxjs/operators';

export const ROTAS_DA_API = {
  cadastro: '/api/auth/cadastro',
  login: '/api/auth/login',
  refresh: '/api/auth/refresh',
  logout: '/api/auth/logout',
} as const;

type RespostaDeSessao = {
  readonly accessToken: string;
  readonly usuario: UsuarioAutenticado;
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  private token: string | null = null;

  private readonly _usuario = signal<UsuarioAutenticado | null>(null);
  readonly usuario = this._usuario.asReadonly();
  readonly autenticado = computed(() => this._usuario() !== null);

  /**
   * A renovação em curso, compartilhada.
   *
   * Sem isto, cinco requisições paralelas que recebem 401 disparam cinco
   * renovações. Como cada refresh é de uso único e rotaciona, a segunda
   * apresentaria um token já revogado — a aplicação acionaria a própria
   * detecção de reúso contra si mesma e derrubaria a sessão do usuário.
   */
  private renovacaoEmCurso: Observable<string> | null = null;

  tokenAtual(): string | null {
    return this.token;
  }

  cadastrar(dados: Cadastro): Observable<UsuarioAutenticado> {
    return this.http
      .post<RespostaDeSessao>(ROTAS_DA_API.cadastro, dados, {
        withCredentials: true,
      })
      .pipe(map((resposta) => this.guardar(resposta)));
  }

  entrar(dados: Login): Observable<UsuarioAutenticado> {
    return this.http
      .post<RespostaDeSessao>(ROTAS_DA_API.login, dados, {
        withCredentials: true,
      })
      .pipe(map((resposta) => this.guardar(resposta)));
  }

  /**
   * Troca o cookie de refresh por um par novo.
   *
   * Chamadas concorrentes recebem a **mesma** requisição, não uma cada.
   */
  renovar(): Observable<string> {
    this.renovacaoEmCurso ??= this.http
      .post<RespostaDeSessao>(ROTAS_DA_API.refresh, null, {
        withCredentials: true,
      })
      .pipe(
        map((resposta) => {
          this.guardar(resposta);
          return resposta.accessToken;
        }),
        // Renovação recusada significa que o cookie venceu ou foi revogado: a
        // sessão acabou. Limpar aqui, e não em cada chamador, porque é este
        // método que sabe disso — a primeira versão espalhou a limpeza por três
        // lugares e esqueceu de um, e foi o teste que apontou.
        catchError((erro: unknown) => {
          this.limpar();
          return throwError(() => erro);
        }),
        // `finalize` **antes** do `shareReplay`, de propósito: assim ele corre
        // quando a requisição termina, e não quando o último inscrito se
        // desinscreve. Depois do `shareReplay`, o campo seria limpo por cada
        // inscrito, e o token ficaria em cache além do seu prazo.
        finalize(() => {
          this.renovacaoEmCurso = null;
        }),
        // Quem chegar durante a requisição recebe o resultado dela, em vez de
        // disparar uma nova.
        shareReplay({ bufferSize: 1, refCount: false }),
      );

    return this.renovacaoEmCurso;
  }

  /**
   * Restaura a sessão na subida da aplicação.
   *
   * É o que faz "fechar o navegador, reabrir e continuar logado" funcionar: o
   * cookie sobreviveu, o token não. Falhar aqui é normal — significa apenas que
   * não havia sessão — então o erro é engolido e a aplicação segue deslogada.
   */
  restaurarSessao(): Observable<boolean> {
    return this.renovar().pipe(
      map(() => true),
      // `renovar` já limpou o estado; aqui só traduzimos "não havia sessão"
      // para um valor, porque na subida isso não é erro.
      catchError(() => of(false)),
    );
  }

  sair(): Observable<void> {
    return this.http
      .post<void>(ROTAS_DA_API.logout, null, { withCredentials: true })
      .pipe(
        // Limpa de qualquer forma: se o servidor recusou, o cliente ainda não
        // deve continuar se comportando como logado.
        catchError(() => of(undefined)),
        tap(() => this.limpar()),
        map(() => undefined),
      );
  }

  limpar(): void {
    this.token = null;
    this._usuario.set(null);
  }

  private guardar(resposta: RespostaDeSessao): UsuarioAutenticado {
    this.token = resposta.accessToken;
    this._usuario.set(resposta.usuario);
    return resposta.usuario;
  }
}

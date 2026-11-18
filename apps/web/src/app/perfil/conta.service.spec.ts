import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ContaService } from './conta.service';

describe('ContaService', () => {
  let servico: ContaService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    servico = TestBed.inject(ContaService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('apaga a conta enviando a senha, com o cookie para o servidor limpá-lo', () => {
    servico.apagar({ senha: 'qualquer' }).subscribe();

    const req = http.expectOne('/api/auth/apagar-conta');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ senha: 'qualquer' });
    expect(req.request.withCredentials).toBe(true);
    req.flush(null);
  });

  it('pede a troca de e-mail enviando a senha e o endereço novo', () => {
    servico
      .pedirTrocaDeEmail({ senha: 'qualquer', novoEmail: 'novo@norbit.dev' })
      .subscribe();

    const req = http.expectOne('/api/auth/trocar-email');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      senha: 'qualquer',
      novoEmail: 'novo@norbit.dev',
    });
    req.flush(null);
  });

  it('confirma a troca com o token do link', () => {
    servico.confirmarEmail({ token: 'abc' }).subscribe();

    const req = http.expectOne('/api/auth/confirmar-email');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ token: 'abc' });
    req.flush(null);
  });
});

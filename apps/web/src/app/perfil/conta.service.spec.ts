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
});

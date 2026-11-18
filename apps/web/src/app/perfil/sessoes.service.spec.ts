import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SessoesService } from './sessoes.service';

describe('SessoesService', () => {
  let servico: SessoesService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    servico = TestBed.inject(SessoesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('lista levando o cookie, que diz qual item é este aparelho', () => {
    servico.listar().subscribe();

    const req = http.expectOne('/api/auth/sessoes');
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);
    req.flush([]);
  });

  it('revoga um aparelho pelo identificador, levando o cookie', () => {
    servico.revogar('abc').subscribe();

    const req = http.expectOne('/api/auth/sessoes/abc');
    expect(req.request.method).toBe('DELETE');
    expect(req.request.withCredentials).toBe(true);
    req.flush(null);
  });
});

import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SenhaService } from './senha.service';

// Montadas em tempo de execução pelo mesmo motivo dos specs da API.
const ATUAL = ['senha', 'atual', 'bem', 'longa'].join(' ');
const NOVA = ['senha', 'nova', 'ainda', 'mais', 'longa'].join(' ');

describe('SenhaService', () => {
  let servico: SenhaService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    servico = TestBed.inject(SenhaService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('troca a senha levando o cookie, que diz qual aparelho poupar', () => {
    servico.trocar({ senhaAtual: ATUAL, novaSenha: NOVA }).subscribe();

    const req = http.expectOne('/api/auth/trocar-senha');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ senhaAtual: ATUAL, novaSenha: NOVA });
    expect(req.request.withCredentials).toBe(true);
    req.flush(null);
  });
});

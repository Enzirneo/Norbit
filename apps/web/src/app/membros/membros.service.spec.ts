import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MembrosService } from './membros.service';

const AGENDA = '01a18471-9684-7755-a2fa-8fc0b6bb6d83';
const MEMBRO = '01a18471-9684-7755-a2fa-8fc0b6bb6d84';

describe('MembrosService', () => {
  let servico: MembrosService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    servico = TestBed.inject(MembrosService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('lista os membros da agenda', () => {
    servico.listar(AGENDA).subscribe();

    const req = http.expectOne(`/api/agendas/${AGENDA}/membros`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('muda o papel de um membro', () => {
    servico.definirPapel(AGENDA, MEMBRO, 'EDITOR').subscribe();

    const req = http.expectOne(`/api/agendas/${AGENDA}/membros/${MEMBRO}`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ papel: 'EDITOR' });
    req.flush(null);
  });

  it('remove um membro', () => {
    servico.remover(AGENDA, MEMBRO).subscribe();

    const req = http.expectOne(`/api/agendas/${AGENDA}/membros/${MEMBRO}`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('sai da agenda pela rota "eu", que não exige gerenciar membros', () => {
    servico.sair(AGENDA).subscribe();

    const req = http.expectOne(`/api/agendas/${AGENDA}/membros/eu`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});

import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ConvitesService } from './convites.service';

const AGENDA = '01a18471-9684-7755-a2fa-8fc0b6bb6d83';
const CONVITE = '01a18471-9684-7755-a2fa-8fc0b6bb6d84';

describe('ConvitesService', () => {
  let servico: ConvitesService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    servico = TestBed.inject(ConvitesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('cria o convite na agenda', () => {
    const dados = { papel: 'VIEWER', validadeDias: 7 } as const;

    servico.criar(AGENDA, dados).subscribe();

    const req = http.expectOne(`/api/agendas/${AGENDA}/convites`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(dados);
    req.flush({});
  });

  it('lista os convites da agenda', () => {
    servico.listar(AGENDA).subscribe();

    const req = http.expectOne(`/api/agendas/${AGENDA}/convites`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('revoga um convite da agenda', () => {
    servico.revogar(AGENDA, CONVITE).subscribe();

    const req = http.expectOne(`/api/agendas/${AGENDA}/convites/${CONVITE}`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('pede a previsão pelo token', () => {
    servico.previsao('abc').subscribe();

    const req = http.expectOne('/api/convites/abc');
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('aceita e recusa pelo token', () => {
    servico.aceitar('abc').subscribe();
    const aceitar = http.expectOne('/api/convites/abc/aceitar');
    expect(aceitar.request.method).toBe('POST');
    aceitar.flush({ calendarId: AGENDA });

    servico.recusar('abc').subscribe();
    const recusar = http.expectOne('/api/convites/abc/recusar');
    expect(recusar.request.method).toBe('POST');
    recusar.flush(null);
  });

  it('escapa o token no caminho: ele vem da query string, e é entrada de fora', () => {
    servico.previsao('a/b?c').subscribe();

    http.expectOne('/api/convites/a%2Fb%3Fc').flush({});
  });
});

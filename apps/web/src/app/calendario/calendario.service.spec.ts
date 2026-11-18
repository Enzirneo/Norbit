import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CalendarioService } from './calendario.service';

const INICIO = new Date('2026-06-15T13:00:00.000Z');
const FIM = new Date('2026-06-15T14:00:00.000Z');

describe('CalendarioService.reagendar', () => {
  let servico: CalendarioService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    servico = TestBed.inject(CalendarioService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('um evento simples recebe só o novo início e o novo fim', () => {
    servico
      .reagendar({
        ocorrencia: {
          id: 'evt-1',
          ehRecorrente: false,
          inicioOriginal: '2026-06-15T09:00:00.000Z',
        },
        inicio: INICIO,
        fim: FIM,
      })
      .subscribe();

    const req = http.expectOne('/api/eventos/evt-1');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ startsAt: INICIO, endsAt: FIM });
    req.flush({});
  });

  it('uma ocorrência de série vira exceção antes de ser movida', () => {
    servico
      .reagendar({
        ocorrencia: {
          id: 'serie-1',
          ehRecorrente: true,
          inicioOriginal: '2026-06-22T09:00:00.000Z',
        },
        inicio: INICIO,
        fim: FIM,
      })
      .subscribe();

    // Primeiro destaca a ocorrência, pela identidade dela dentro da série...
    const destacar = http.expectOne(
      '/api/eventos/serie-1/ocorrencias/2026-06-22T09%3A00%3A00.000Z/destacar',
    );
    expect(destacar.request.method).toBe('POST');
    destacar.flush({ id: 'filha-1' });

    // ...e então move a exceção, sem a regra: ela é uma ocorrência só, e sem
    // o `null` nasceria uma segunda série paralela.
    const mover = http.expectOne('/api/eventos/filha-1');
    expect(mover.request.method).toBe('PATCH');
    expect(mover.request.body).toEqual({
      startsAt: INICIO,
      endsAt: FIM,
      recurrenceRule: null,
    });
    mover.flush({});
  });

  it('se destacar falha, nada é movido', () => {
    let falhou = false;
    servico
      .reagendar({
        ocorrencia: {
          id: 'serie-1',
          ehRecorrente: true,
          inicioOriginal: '2026-06-22T09:00:00.000Z',
        },
        inicio: INICIO,
        fim: FIM,
      })
      .subscribe({ error: () => (falhou = true) });

    http
      .expectOne((r) => r.url.endsWith('/destacar'))
      .flush(null, { status: 403, statusText: 'Forbidden' });

    expect(falhou).toBe(true);
    http.expectNone('/api/eventos/filha-1');
  });
});

/**
 * O mês: o que a tela decide a partir dos dados. A aparência (raio, barra, fonte)
 * é medida no navegador em `mes-e-casca-visual.spec.ts`.
 */
import { TestBed } from '@angular/core/testing';
import type {
  AgendaVisivel,
  OcorrenciaVisivel,
  PapelNaAgenda,
} from '@norbit/contracts';
import { faseDoDia, gradeDeMes, iluminacao, nomeDaFase } from '@norbit/domain';
import { VisaoDeMes } from './visao-de-mes';

const FUSO = 'America/Sao_Paulo';
const HOJE = { ano: 2026, mes: 11, dia: 18 };

function agenda(papel: PapelNaAgenda = 'OWNER'): AgendaVisivel {
  return {
    id: 'agenda-1',
    name: 'Nós dois',
    description: null,
    kind: 'SHARED',
    color: '#a97bff',
    icon: null,
    timeZone: FUSO,
    isDefault: false,
    arquivada: false,
    papel,
    ownerId: 'dono',
    escondida: false,
    corPropria: null,
  };
}

function ocorrencia(
  titulo: string,
  calendarId = 'agenda-1',
): OcorrenciaVisivel {
  return {
    id: `evt-${titulo}`,
    calendarId,
    title: titulo,
    description: null,
    location: null,
    color: null,
    inicio: '2026-11-20T15:00:00.000Z',
    fim: '2026-11-20T16:00:00.000Z',
    inicioOriginal: '2026-11-20T15:00:00.000Z',
    isAllDay: false,
    timeZone: FUSO,
    status: 'CONFIRMED',
    ehRecorrente: false,
    createdById: 'dono',
  };
}

function montar(ocorrencias: OcorrenciaVisivel[] = []): HTMLElement {
  const fixture = TestBed.createComponent(VisaoDeMes);
  fixture.componentRef.setInput(
    'grade',
    gradeDeMes({ ano: 2026, mes: 11, inicioDaSemana: 0 }),
  );
  fixture.componentRef.setInput('agendas', [agenda()]);
  fixture.componentRef.setInput('ocorrencias', ocorrencias);
  fixture.componentRef.setInput('fuso', FUSO);
  fixture.componentRef.setInput('hoje', HOJE);
  fixture.componentRef.setInput('vinteEQuatroHoras', true);
  fixture.detectChanges();

  return fixture.nativeElement as HTMLElement;
}

/** O número de um dia (o primeiro com esse texto: o do mês, e não o do seguinte). */
function numero(raiz: HTMLElement, dia: number, indice = 0): HTMLElement {
  const achados = Array.from(
    raiz.querySelectorAll<HTMLElement>('.numero'),
  ).filter((n) => n.textContent.trim() === String(dia));
  const achado = achados[indice];
  if (!achado) {
    throw new Error(`O dia ${dia} (${indice}) não está na grade.`);
  }
  return achado;
}

describe('VisaoDeMes', () => {
  it('cada dia da grade tem a lua do dia, com o nome e a iluminação certos', () => {
    const raiz = montar();
    const grade = gradeDeMes({ ano: 2026, mes: 11, inicioDaSemana: 0 });
    const dias = grade.semanas.flat();

    const rotulos = Array.from(
      raiz.querySelectorAll('.numero-area nb-lua svg'),
    ).map((svg) => svg.getAttribute('aria-label'));

    expect(rotulos).toHaveLength(dias.length);
    expect(rotulos).toEqual(
      dias.map((d) => {
        const fase = faseDoDia(d);
        return `${nomeDaFase(fase)}, ${iluminacao(fase)}% iluminada`;
      }),
    );
  });

  it('os dias que já passaram recuam, e hoje e o futuro não', () => {
    const raiz = montar();

    expect(numero(raiz, 10).classList.contains('numero--passado')).toBe(true);
    expect(numero(raiz, 17).classList.contains('numero--passado')).toBe(true);
    // Hoje não é passado: ele brilha.
    expect(numero(raiz, 18).classList.contains('numero--passado')).toBe(false);
    expect(numero(raiz, 18).classList.contains('numero--hoje')).toBe(true);
    expect(numero(raiz, 25).classList.contains('numero--passado')).toBe(false);
  });

  it('os dias de outro mês recuam, mesmo os que ainda vêm', () => {
    const raiz = montar();
    // O primeiro 10 é o de novembro, e o segundo, o de dezembro.
    const dezembro = numero(raiz, 10, 1);

    expect(dezembro.classList.contains('numero--fora')).toBe(true);
    expect(dezembro.classList.contains('numero--passado')).toBe(false);
    expect(numero(raiz, 10, 0).classList.contains('numero--fora')).toBe(false);
  });

  it('a cor da agenda chega à barra como `--c`', () => {
    const raiz = montar([ocorrencia('Cinema')]);
    const barra = raiz.querySelector<HTMLElement>('.barra');

    expect(barra?.style.getPropertyValue('--c')).toBe('#a97bff');
  });

  it('uma agenda fora da lista cai no destaque do tema', () => {
    const raiz = montar([ocorrencia('Sem agenda', 'agenda-que-sumiu')]);
    const barra = raiz.querySelector<HTMLElement>('.barra');

    expect(barra?.style.getPropertyValue('--c')).toBe('var(--accent)');
  });
});

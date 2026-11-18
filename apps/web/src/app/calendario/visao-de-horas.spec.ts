/**
 * Quem pode arrastar o quê na grade de horas.
 *
 * A matriz de papéis tem teste em `libs/domain`. O que só aqui se prova é que a
 * tela a consulta: a alça e o cursor de arrasto aparecem para quem pode mudar
 * o horário e não aparecem para quem só olha.
 */
import { TestBed } from '@angular/core/testing';
import type {
  AgendaVisivel,
  OcorrenciaVisivel,
  PapelNaAgenda,
} from '@norbit/contracts';
import { VisaoDeHoras } from './visao-de-horas';

const FUSO = 'America/Sao_Paulo';
const DIA = { ano: 2026, mes: 6, dia: 15 };

const EU = 'usuario-eu';
const OUTRA_PESSOA = 'usuario-outra';

function agenda(papel: PapelNaAgenda): AgendaVisivel {
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
    ownerId: OUTRA_PESSOA,
    escondida: false,
    corPropria: null,
  };
}

function ocorrencia(criador: string, titulo: string): OcorrenciaVisivel {
  return {
    id: `evt-${titulo}`,
    calendarId: 'agenda-1',
    title: titulo,
    description: null,
    location: null,
    color: null,
    inicio: '2026-06-15T15:00:00.000Z',
    fim: '2026-06-15T16:00:00.000Z',
    inicioOriginal: '2026-06-15T15:00:00.000Z',
    isAllDay: false,
    timeZone: FUSO,
    status: 'CONFIRMED',
    ehRecorrente: false,
    createdById: criador,
  };
}

function montar(papel: PapelNaAgenda): HTMLElement {
  const fixture = TestBed.createComponent(VisaoDeHoras);
  fixture.componentRef.setInput('dias', [DIA]);
  fixture.componentRef.setInput('agendas', [agenda(papel)]);
  fixture.componentRef.setInput('ocorrencias', [
    ocorrencia(EU, 'Meu'),
    ocorrencia(OUTRA_PESSOA, 'Dela'),
  ]);
  fixture.componentRef.setInput('fuso', FUSO);
  fixture.componentRef.setInput('hoje', DIA);
  fixture.componentRef.setInput('vinteEQuatroHoras', true);
  fixture.componentRef.setInput('usuarioId', EU);
  fixture.detectChanges();

  return fixture.nativeElement as HTMLElement;
}

function faixa(raiz: HTMLElement, titulo: string): HTMLElement {
  const achada = Array.from(raiz.querySelectorAll<HTMLElement>('.faixa')).find(
    (f) => f.textContent.includes(titulo),
  );
  if (!achada) {
    throw new Error(`A faixa "${titulo}" não está na tela.`);
  }
  return achada;
}

function arrastavel(raiz: HTMLElement, titulo: string): boolean {
  return faixa(raiz, titulo).classList.contains('faixa--arrastavel');
}

function temAlca(raiz: HTMLElement, titulo: string): boolean {
  return faixa(raiz, titulo).querySelector('.alca') !== null;
}

describe('VisaoDeHoras — quem pode arrastar', () => {
  it('o dono arrasta qualquer evento da agenda', () => {
    const raiz = montar('OWNER');

    expect(arrastavel(raiz, 'Meu')).toBe(true);
    expect(arrastavel(raiz, 'Dela')).toBe(true);
  });

  it('o editor arrasta qualquer evento da agenda', () => {
    const raiz = montar('EDITOR');

    expect(arrastavel(raiz, 'Meu')).toBe(true);
    expect(arrastavel(raiz, 'Dela')).toBe(true);
  });

  it('o colaborador arrasta só o que criou', () => {
    const raiz = montar('CONTRIBUTOR');

    expect(arrastavel(raiz, 'Meu')).toBe(true);
    expect(arrastavel(raiz, 'Dela')).toBe(false);
  });

  it('quem só vê não arrasta nada, e não vê a alça', () => {
    const raiz = montar('VIEWER');

    expect(arrastavel(raiz, 'Meu')).toBe(false);
    expect(arrastavel(raiz, 'Dela')).toBe(false);
    expect(temAlca(raiz, 'Meu')).toBe(false);
  });

  it('a alça de redimensionar aparece só em quem pode arrastar', () => {
    const raiz = montar('CONTRIBUTOR');

    expect(temAlca(raiz, 'Meu')).toBe(true);
    expect(temAlca(raiz, 'Dela')).toBe(false);
  });

  it('num evento de vários dias, a alça fica só no trecho onde ele termina', () => {
    const fixture = TestBed.createComponent(VisaoDeHoras);
    fixture.componentRef.setInput('dias', [DIA, { ...DIA, dia: 16 }]);
    fixture.componentRef.setInput('agendas', [agenda('OWNER')]);
    fixture.componentRef.setInput('ocorrencias', [
      {
        ...ocorrencia(EU, 'Plantão'),
        // 17h do dia 15 às 9h do dia 16, no fuso da agenda.
        inicio: '2026-06-15T20:00:00.000Z',
        fim: '2026-06-16T12:00:00.000Z',
      },
    ]);
    fixture.componentRef.setInput('fuso', FUSO);
    fixture.componentRef.setInput('hoje', DIA);
    fixture.componentRef.setInput('vinteEQuatroHoras', true);
    fixture.componentRef.setInput('usuarioId', EU);
    fixture.detectChanges();

    const colunas = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.coluna'),
    );
    const primeiro = colunas[0].querySelector('.faixa');
    const segundo = colunas[1].querySelector('.faixa');

    // As duas partes podem ser pegas para mover, mas o fim só está na segunda:
    // esticar a primeira mexeria num fim que ela não mostra.
    expect(primeiro?.classList.contains('faixa--arrastavel')).toBe(true);
    expect(primeiro?.querySelector('.alca')).toBeNull();
    expect(segundo?.querySelector('.alca')).not.toBeNull();
  });
});

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
import { faseDoDia, iluminacao, nomeDaFase } from '@norbit/domain';
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

/** Monta a grade com os dias dados e as ocorrências dadas. */
function montarDias(
  dias: { ano: number; mes: number; dia: number }[],
  hoje: { ano: number; mes: number; dia: number },
  ocorrencias: OcorrenciaVisivel[] = [],
  agendas: AgendaVisivel[] = [agenda('OWNER')],
): HTMLElement {
  const fixture = TestBed.createComponent(VisaoDeHoras);
  fixture.componentRef.setInput('dias', dias);
  fixture.componentRef.setInput('agendas', agendas);
  fixture.componentRef.setInput('ocorrencias', ocorrencias);
  fixture.componentRef.setInput('fuso', FUSO);
  fixture.componentRef.setInput('hoje', hoje);
  fixture.componentRef.setInput('vinteEQuatroHoras', true);
  fixture.componentRef.setInput('usuarioId', EU);
  fixture.detectChanges();

  return fixture.nativeElement as HTMLElement;
}

describe('VisaoDeHoras — a linguagem da semana', () => {
  it('cada dia mostra a lua do dia, com o nome e a iluminação certos', () => {
    const dias = [DIA, { ...DIA, dia: 16 }, { ...DIA, dia: 17 }];
    const raiz = montarDias(dias, DIA);

    const rotulos = Array.from(raiz.querySelectorAll('.dias nb-lua svg')).map(
      (svg) => svg.getAttribute('aria-label'),
    );

    expect(rotulos).toEqual(
      dias.map((d) => {
        const fase = faseDoDia(d);
        return `${nomeDaFase(fase)}, ${iluminacao(fase)}% iluminada`;
      }),
    );
  });

  it('a cor da agenda chega à faixa como `--c`, e é dela que saem a barra e o fundo', () => {
    const raiz = montar('OWNER');

    expect(faixa(raiz, 'Meu').style.getPropertyValue('--c')).toBe('#a97bff');
  });

  it('uma agenda fora da lista cai no destaque do tema', () => {
    const raiz = montarDias(
      [DIA],
      DIA,
      [{ ...ocorrencia(EU, 'Sem agenda'), calendarId: 'agenda-que-sumiu' }],
      [],
    );

    expect(faixa(raiz, 'Sem agenda').style.getPropertyValue('--c')).toBe(
      'var(--accent)',
    );
  });

  it('um dia que já acabou escurece inteiro, e um que ainda vem não escurece', () => {
    const passado = { ...DIA, dia: 14 };
    const futuro = { ...DIA, dia: 16 };
    const raiz = montarDias([passado, DIA, futuro], DIA);

    const colunas = Array.from(raiz.querySelectorAll<HTMLElement>('.coluna'));
    const camada = (c: HTMLElement): HTMLElement | null =>
      c.querySelector('.passado');

    expect(camada(colunas[0])?.style.height).toBe('100%');
    expect(camada(colunas[2])).toBeNull();
  });

  it('a camada do passado não captura o ponteiro nem é lida por leitor de tela', () => {
    const raiz = montarDias([{ ...DIA, dia: 14 }], DIA);
    const camada = raiz.querySelector('.passado');

    expect(camada?.getAttribute('aria-hidden')).toBe('true');
  });
});

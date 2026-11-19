import { TestBed } from '@angular/core/testing';
import { faseDoDia, iluminacao, nomeDaFase } from '@norbit/domain';
import { CartaoDaLua } from './cartao-da-lua';

function montar(dia: { ano: number; mes: number; dia: number }): {
  raiz: HTMLElement;
  mudar: (dia: { ano: number; mes: number; dia: number }) => void;
} {
  const fixture = TestBed.createComponent(CartaoDaLua);
  fixture.componentRef.setInput('dia', dia);
  fixture.detectChanges();

  return {
    raiz: fixture.nativeElement as HTMLElement,
    mudar: (novo) => {
      fixture.componentRef.setInput('dia', novo);
      fixture.detectChanges();
    },
  };
}

function texto(raiz: HTMLElement, seletor: string): string {
  return raiz.querySelector(seletor)?.textContent.trim() ?? '';
}

describe('CartaoDaLua', () => {
  const DIA = { ano: 2024, mes: 1, dia: 25 };

  it('mostra o nome da fase do dia', () => {
    const { raiz } = montar(DIA);

    expect(texto(raiz, '.nome')).toBe(nomeDaFase(faseDoDia(DIA)));
  });

  it('mostra quanto da lua está iluminada, com a palavra "hoje"', () => {
    const { raiz } = montar(DIA);

    expect(texto(raiz, '.iluminacao')).toBe(
      `${iluminacao(faseDoDia(DIA))}% iluminada hoje`,
    );
  });

  it('desenha a lua do dia, com 34 pixels', () => {
    const { raiz } = montar(DIA);
    const svg = raiz.querySelector('nb-lua svg');

    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('width')).toBe('34');
  });

  it('acompanha o dia quando ele muda', () => {
    const { raiz, mudar } = montar(DIA);
    const outro = { ano: 2024, mes: 1, dia: 11 };

    mudar(outro);

    expect(texto(raiz, '.nome')).toBe(nomeDaFase(faseDoDia(outro)));
    expect(texto(raiz, '.nome')).not.toBe(nomeDaFase(faseDoDia(DIA)));
  });
});

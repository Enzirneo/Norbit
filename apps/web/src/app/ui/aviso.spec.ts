import { Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Aviso, type TipoDeAviso } from './aviso';

@Component({
  imports: [Aviso],
  template: `<nb-aviso [tipo]="tipo()">Algo aconteceu</nb-aviso>`,
})
class Anfitriao {
  readonly tipo = input<TipoDeAviso>('info');
}

@Component({
  imports: [Aviso],
  template: `<nb-aviso>Sem tipo</nb-aviso>`,
})
class AnfitriaoSemTipo {}

function montar(tipo: TipoDeAviso): HTMLElement {
  const fixture = TestBed.createComponent(Anfitriao);
  fixture.componentRef.setInput('tipo', tipo);
  fixture.detectChanges();

  const aviso = (fixture.nativeElement as HTMLElement).querySelector(
    'nb-aviso',
  );
  if (!aviso) {
    throw new Error('O aviso não foi desenhado.');
  }
  return aviso as HTMLElement;
}

describe('Aviso', () => {
  it('mostra o que foi projetado dentro dele', () => {
    expect(montar('info').textContent).toContain('Algo aconteceu');
  });

  it('um perigo é anunciado na hora: role alert', () => {
    expect(montar('perigo').getAttribute('role')).toBe('alert');
  });

  it.each(['info', 'sucesso'] as const)(
    'um aviso de %s espera a vez do leitor de tela: role status',
    (tipo) => {
      expect(montar(tipo).getAttribute('role')).toBe('status');
    },
  );

  it('cada tipo leva a sua classe, que é o que o CSS lê', () => {
    for (const tipo of ['info', 'sucesso', 'perigo'] as const) {
      expect(montar(tipo).classList.contains(`aviso--${tipo}`)).toBe(true);
    }
  });

  it('sem tipo, é uma informação', () => {
    const fixture = TestBed.createComponent(AnfitriaoSemTipo);
    fixture.detectChanges();
    const aviso = (fixture.nativeElement as HTMLElement).querySelector(
      'nb-aviso',
    );

    expect(aviso?.getAttribute('role')).toBe('status');
    expect(aviso?.classList.contains('aviso--info')).toBe(true);
  });
});

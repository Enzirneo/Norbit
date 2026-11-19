import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Etiqueta } from './etiqueta';

@Component({
  imports: [Etiqueta],
  template: `<nb-etiqueta>Dono</nb-etiqueta
    ><nb-etiqueta tom="destaque">Padrão</nb-etiqueta>`,
})
class Anfitriao {}

describe('Etiqueta', () => {
  it('mostra o texto projetado, e o tom padrão é neutro', () => {
    const fixture = TestBed.createComponent(Anfitriao);
    fixture.detectChanges();
    const [dono, padrao] = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('nb-etiqueta'),
    );

    expect(dono.textContent).toBe('Dono');
    expect(dono.classList.contains('etiqueta--neutro')).toBe(true);
    expect(padrao.classList.contains('etiqueta--destaque')).toBe(true);
  });
});

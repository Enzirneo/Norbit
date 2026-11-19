import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CabecalhoDePagina } from './cabecalho-de-pagina';

@Component({
  imports: [CabecalhoDePagina],
  template: `<nb-cabecalho-de-pagina titulo="Perfil" />`,
})
class Anfitriao {}

describe('CabecalhoDePagina', () => {
  it('o título é o h1 da página', () => {
    const fixture = TestBed.createComponent(Anfitriao);
    fixture.detectChanges();

    const h1 = (fixture.nativeElement as HTMLElement).querySelector('h1');
    expect(h1?.textContent).toBe('Perfil');
  });
});

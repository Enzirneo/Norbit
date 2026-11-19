import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { EstadoVazio } from './estado-vazio';

@Component({
  imports: [EstadoVazio],
  template: `<nb-estado-vazio titulo="Nada em órbita por aqui."
    >Clique num dia.</nb-estado-vazio
  >`,
})
class Anfitriao {}

describe('EstadoVazio', () => {
  it('mostra o título em destaque e a explicação projetada', () => {
    const fixture = TestBed.createComponent(Anfitriao);
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;

    expect(raiz.querySelector('.vazio-titulo')?.textContent).toBe(
      'Nada em órbita por aqui.',
    );
    expect(raiz.textContent).toContain('Clique num dia.');
  });
});

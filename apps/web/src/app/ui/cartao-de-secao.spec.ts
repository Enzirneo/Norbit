import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CartaoDeSecao } from './cartao-de-secao';

@Component({
  imports: [CartaoDeSecao],
  template: `<nb-cartao-de-secao titulo="Aparência"
    ><p>conteúdo</p></nb-cartao-de-secao
  >`,
})
class Anfitriao {}

describe('CartaoDeSecao', () => {
  it('é uma seção com o título num h2 e o conteúdo projetado', () => {
    const fixture = TestBed.createComponent(Anfitriao);
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;

    expect(raiz.querySelector('section h2')?.textContent).toBe('Aparência');
    expect(raiz.querySelector('p')?.textContent).toBe('conteúdo');
  });

  it('a seção é nomeada pelo título, para o leitor de tela listá-la', () => {
    const fixture = TestBed.createComponent(Anfitriao);
    fixture.detectChanges();
    const secao = (fixture.nativeElement as HTMLElement).querySelector(
      'section',
    );
    const titulo = secao?.querySelector('h2');

    expect(titulo?.id).toBeTruthy();
    expect(secao?.getAttribute('aria-labelledby')).toBe(titulo?.id);
  });
});

import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MolduraDeConfiguracoes } from './moldura-de-configuracoes';

@Component({
  imports: [MolduraDeConfiguracoes],
  template: `<nb-moldura-de-configuracoes titulo="Aparência"
    ><p class="conteudo-de-teste">dentro</p></nb-moldura-de-configuracoes
  >`,
})
class Anfitriao {}

function montar(): HTMLElement {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(Anfitriao);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('MolduraDeConfiguracoes', () => {
  it('põe o título num h1 e o conteúdo projetado dentro', () => {
    const raiz = montar();

    expect(raiz.querySelector('h1')?.textContent).toBe('Aparência');
    expect(raiz.querySelector('main .conteudo-de-teste')).not.toBeNull();
  });

  it('tem um menu nomeado com as quatro áreas, e os destinos certos', () => {
    const raiz = montar();
    const menu = raiz.querySelector('nav');
    const links = Array.from(menu?.querySelectorAll('a') ?? []);

    expect(menu?.getAttribute('aria-label')).toBe('Configurações');
    expect(links.map((l) => l.textContent.trim())).toEqual([
      'Aparência',
      'Preferências',
      'Perfil',
      'Segurança',
    ]);
    expect(links.map((l) => l.getAttribute('href'))).toEqual([
      '/aparencia',
      '/preferencias',
      '/perfil',
      '/seguranca',
    ]);
  });

  it('volta ao calendário', () => {
    const raiz = montar();

    expect(raiz.textContent).toContain('Voltar ao calendário');
  });
});

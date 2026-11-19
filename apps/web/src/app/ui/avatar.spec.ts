import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Avatar } from './avatar';

@Component({
  imports: [Avatar],
  template: `<nb-avatar nome="Maria Souza" /><nb-avatar
      nome="Enzo"
      tamanho="g"
    />`,
})
class Anfitriao {}

function montar(): HTMLElement[] {
  const fixture = TestBed.createComponent(Anfitriao);
  fixture.detectChanges();
  return Array.from(
    (fixture.nativeElement as HTMLElement).querySelectorAll('nb-avatar'),
  );
}

describe('Avatar', () => {
  it('mostra as iniciais do nome', () => {
    const [maria, enzo] = montar();

    expect(maria.textContent.trim()).toBe('MS');
    expect(enzo.textContent.trim()).toBe('E');
  });

  it('é decorativo: o nome já aparece ao lado, então o leitor de tela o ignora', () => {
    expect(montar()[0].getAttribute('aria-hidden')).toBe('true');
  });

  it('o tamanho padrão é médio; o pedido vira classe', () => {
    const [maria, enzo] = montar();

    expect(maria.classList.contains('avatar--m')).toBe(true);
    expect(enzo.classList.contains('avatar--g')).toBe(true);
  });
});

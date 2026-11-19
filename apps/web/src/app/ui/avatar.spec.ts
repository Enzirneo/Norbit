import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Avatar } from './avatar';

@Component({
  imports: [Avatar],
  template: `
    <nb-avatar nome="Maria Souza" />
    <nb-avatar nome="Enzo" tamanho="g" />
    <nb-avatar nome="Ana" cor="#4adebb" />
    <nb-avatar nome="Zé" cor="#767676" />
  `,
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

  describe('com cor de perfil', () => {
    it('o fundo é a cor escolhida e o texto se lê sobre ela', () => {
      const ana = montar()[2];

      expect(ana.style.getPropertyValue('--avatar-fundo')).toBe('#4adebb');
      expect(ana.style.getPropertyValue('--avatar-texto')).not.toBe('');
      expect(ana.classList.contains('avatar--cor')).toBe(true);
    });

    it('uma cor que não aguenta texto é ajustada, sem mudar o que a pessoa escolheu', () => {
      const ze = montar()[3];

      expect(ze.style.getPropertyValue('--avatar-fundo')).not.toBe('#767676');
    });

    it('sem cor, não há variáveis: vale o destaque do tema', () => {
      const maria = montar()[0];

      expect(maria.style.getPropertyValue('--avatar-fundo')).toBe('');
      expect(maria.classList.contains('avatar--cor')).toBe(false);
    });
  });
});

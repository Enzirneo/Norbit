import { TestBed } from '@angular/core/testing';
import { Catalogo } from './catalogo';

function montar(): { raiz: HTMLElement; atualizar: () => void } {
  const fixture = TestBed.createComponent(Catalogo);
  fixture.detectChanges();
  return {
    raiz: fixture.nativeElement as HTMLElement,
    atualizar: () => fixture.detectChanges(),
  };
}

function controle<T extends HTMLElement>(
  raiz: HTMLElement,
  seletor: string,
): T {
  const achado = raiz.querySelector<T>(seletor);
  if (!achado) {
    throw new Error(`Não achei ${seletor} no catálogo.`);
  }
  return achado;
}

function variavel(nome: string): string {
  return document.documentElement.style.getPropertyValue(nome);
}

describe('Catalogo', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('style');
  });

  it('mostra cada componente do design system', () => {
    const { raiz } = montar();

    for (const seletor of [
      'button[nb-botao]',
      'nb-campo',
      'nb-alternador',
      'nb-aviso',
      'nb-avatar',
      'nb-etiqueta',
      'nb-estado-vazio',
      'nb-cartao-de-secao',
      'nb-lua',
      '.nb-entrada',
      '.nb-caixa',
    ]) {
      expect(raiz.querySelector(seletor), seletor).not.toBeNull();
    }
  });

  it('aplica o tema escolhido na página, sem guardar nada', () => {
    const { raiz, atualizar } = montar();
    const escolha = controle<HTMLSelectElement>(raiz, '#tema');

    escolha.value = 'dawn';
    escolha.dispatchEvent(new Event('change'));
    atualizar();

    expect(variavel('--surface-base')).toBe('#f6f1ea');
    expect(localStorage.getItem('norbit:aparencia')).toBeNull();
  });

  it('os cantos mudam o raio-base', () => {
    const { raiz, atualizar } = montar();
    const cantos = controle<HTMLInputElement>(raiz, '#cantos');

    cantos.value = '14';
    cantos.dispatchEvent(new Event('input'));
    atualizar();

    expect(variavel('--r')).toBe('14px');
  });

  it('mostra os avisos do motor quando ele ajusta uma semente', () => {
    const { raiz, atualizar } = montar();
    const fundo = controle<HTMLInputElement>(raiz, '#fundo');

    fundo.value = '#808080';
    fundo.dispatchEvent(new Event('input'));
    atualizar();

    expect(raiz.querySelector('.avisos-do-motor')?.textContent).toContain(
      'Ajustamos',
    );
  });

  it('ao sair, devolve a aparência da conta', () => {
    const fixture = TestBed.createComponent(Catalogo);
    fixture.detectChanges();
    document.documentElement.style.setProperty('--surface-base', '#ffffff');

    fixture.destroy();

    expect(variavel('--surface-base')).toBe('#0b0d17');
  });
});

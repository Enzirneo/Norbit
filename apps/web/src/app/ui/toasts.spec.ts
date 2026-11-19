import { TestBed } from '@angular/core/testing';
import { ToastService } from './toast.service';
import { Toasts } from './toasts';

function montar(): {
  raiz: HTMLElement;
  servico: ToastService;
  atualizar: () => void;
} {
  const fixture = TestBed.createComponent(Toasts);
  const servico = TestBed.inject(ToastService);
  fixture.detectChanges();

  return {
    raiz: fixture.nativeElement as HTMLElement,
    servico,
    atualizar: () => fixture.detectChanges(),
  };
}

describe('Toasts', () => {
  it('é uma região de notificações, vazia quando não há nenhuma', () => {
    const { raiz } = montar();

    const regiao = raiz.querySelector('[role="region"]');
    expect(regiao?.getAttribute('aria-label')).toBe('Notificações');
    expect(raiz.querySelectorAll('.toast')).toHaveLength(0);
  });

  it('mostra o texto de cada aviso', () => {
    const { raiz, servico, atualizar } = montar();

    servico.mostrar('Perfil salvo.');
    atualizar();

    expect(raiz.querySelector('.toast')?.textContent).toContain(
      'Perfil salvo.',
    );
  });

  it('um sucesso é role status, e um perigo é role alert', () => {
    const { raiz, servico, atualizar } = montar();

    servico.mostrar('Salvo', { tipo: 'sucesso' });
    servico.mostrar('Falhou', { tipo: 'perigo' });
    atualizar();

    const papeis = Array.from(raiz.querySelectorAll('.toast')).map((t) =>
      t.getAttribute('role'),
    );
    expect(papeis).toEqual(['status', 'alert']);
  });

  it('cada toast leva a classe do seu tipo, que é o que o CSS lê', () => {
    const { raiz, servico, atualizar } = montar();

    servico.mostrar('Falhou', { tipo: 'perigo' });
    atualizar();

    expect(
      raiz.querySelector('.toast')?.classList.contains('toast--perigo'),
    ).toBe(true);
  });

  it('o botão de fechar dispensa o aviso', () => {
    const { raiz, servico, atualizar } = montar();
    servico.mostrar('Perfil salvo.');
    atualizar();

    raiz.querySelector<HTMLButtonElement>('.fechar')?.click();
    atualizar();

    expect(servico.toasts()).toHaveLength(0);
    expect(raiz.querySelectorAll('.toast')).toHaveLength(0);
  });

  it('o botão de fechar tem um nome para o leitor de tela', () => {
    const { raiz, servico, atualizar } = montar();
    servico.mostrar('Perfil salvo.');
    atualizar();

    expect(raiz.querySelector('.fechar')?.getAttribute('aria-label')).toBe(
      'Fechar aviso',
    );
  });
});

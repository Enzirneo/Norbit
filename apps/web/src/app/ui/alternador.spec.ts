import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Alternador } from './alternador';

type Visao = 'MONTH' | 'WEEK' | 'DAY';

const OPCOES: readonly { valor: Visao; rotulo: string }[] = [
  { valor: 'MONTH', rotulo: 'Mês' },
  { valor: 'WEEK', rotulo: 'Semana' },
  { valor: 'DAY', rotulo: 'Dia' },
];

@Component({
  imports: [Alternador],
  template: `<nb-alternador
    rotulo="Visão do calendário"
    [opcoes]="opcoes"
    [valor]="valor()"
    (escolhido)="valor.set($event)"
  />`,
})
class Anfitriao {
  protected readonly opcoes = OPCOES;
  readonly valor = signal<Visao>('WEEK');
}

function montar(): {
  raiz: HTMLElement;
  anfitriao: Anfitriao;
  botoes: () => HTMLButtonElement[];
  atualizar: () => void;
} {
  const fixture = TestBed.createComponent(Anfitriao);
  fixture.detectChanges();
  const raiz = fixture.nativeElement as HTMLElement;

  return {
    raiz,
    anfitriao: fixture.componentInstance,
    botoes: () => Array.from(raiz.querySelectorAll('button')),
    atualizar: () => fixture.detectChanges(),
  };
}

function teclar(alvo: HTMLElement, tecla: string): void {
  alvo.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: tecla,
      bubbles: true,
      cancelable: true,
    }),
  );
}

describe('Alternador', () => {
  it('é um grupo de rádio com o nome dado, e uma opção para cada valor', () => {
    const { raiz, botoes } = montar();
    const grupo = raiz.querySelector('[role="radiogroup"]');

    expect(grupo?.getAttribute('aria-label')).toBe('Visão do calendário');
    expect(botoes().map((b) => b.textContent.trim())).toEqual([
      'Mês',
      'Semana',
      'Dia',
    ]);
    expect(botoes().every((b) => b.getAttribute('role') === 'radio')).toBe(
      true,
    );
  });

  it('só a opção escolhida está marcada, e só ela entra na ordem do Tab', () => {
    const { botoes } = montar();

    expect(botoes().map((b) => b.getAttribute('aria-checked'))).toEqual([
      'false',
      'true',
      'false',
    ]);
    expect(botoes().map((b) => b.getAttribute('tabindex'))).toEqual([
      '-1',
      '0',
      '-1',
    ]);
  });

  it('clicar numa opção a escolhe', () => {
    const { botoes, anfitriao, atualizar } = montar();

    botoes()[2].click();
    atualizar();

    expect(anfitriao.valor()).toBe('DAY');
    expect(botoes()[2].getAttribute('aria-checked')).toBe('true');
    expect(botoes()[1].getAttribute('aria-checked')).toBe('false');
  });

  it('a seta para a direita escolhe a próxima, e a da esquerda, a anterior', () => {
    const { botoes, anfitriao, atualizar } = montar();

    teclar(botoes()[1], 'ArrowRight');
    atualizar();
    expect(anfitriao.valor()).toBe('DAY');

    teclar(botoes()[2], 'ArrowLeft');
    atualizar();
    expect(anfitriao.valor()).toBe('WEEK');
  });

  it('as setas para baixo e para cima fazem o mesmo, como num grupo de rádio', () => {
    const { botoes, anfitriao, atualizar } = montar();

    teclar(botoes()[1], 'ArrowDown');
    atualizar();
    expect(anfitriao.valor()).toBe('DAY');

    teclar(botoes()[2], 'ArrowUp');
    atualizar();
    expect(anfitriao.valor()).toBe('WEEK');
  });

  it('nas pontas ele dá a volta', () => {
    const { botoes, anfitriao, atualizar } = montar();

    // De "Semana" até "Dia", e mais uma para a direita: volta a "Mês".
    teclar(botoes()[1], 'ArrowRight');
    atualizar();
    teclar(botoes()[2], 'ArrowRight');
    atualizar();
    expect(anfitriao.valor()).toBe('MONTH');

    teclar(botoes()[0], 'ArrowLeft');
    atualizar();
    expect(anfitriao.valor()).toBe('DAY');
  });

  it('Home vai para a primeira opção e End para a última', () => {
    const { botoes, anfitriao, atualizar } = montar();

    teclar(botoes()[1], 'End');
    atualizar();
    expect(anfitriao.valor()).toBe('DAY');

    teclar(botoes()[2], 'Home');
    atualizar();
    expect(anfitriao.valor()).toBe('MONTH');
  });

  it('o foco acompanha a opção escolhida pelo teclado', () => {
    const { botoes, atualizar, raiz } = montar();
    document.body.append(raiz);

    botoes()[1].focus();
    teclar(botoes()[1], 'ArrowRight');
    atualizar();

    expect(document.activeElement).toBe(botoes()[2]);
    raiz.remove();
  });

  it('a seta parte da opção que tem o foco, não da escolhida', () => {
    const { botoes, anfitriao, atualizar } = montar();

    // "Semana" está escolhida, mas o foco chegou em "Mês" (por clique do mouse
    // em outro lugar, por exemplo): a seta leva a "Semana", a vizinha do foco.
    teclar(botoes()[0], 'ArrowRight');
    atualizar();

    expect(anfitriao.valor()).toBe('WEEK');
  });

  it('outras teclas não fazem nada', () => {
    const { botoes, anfitriao, atualizar } = montar();

    teclar(botoes()[1], 'a');
    teclar(botoes()[1], 'Enter');
    atualizar();

    expect(anfitriao.valor()).toBe('WEEK');
  });
});

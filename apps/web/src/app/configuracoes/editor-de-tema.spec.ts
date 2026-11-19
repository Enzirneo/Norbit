import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { TEMA_PADRAO } from '@norbit/contracts';
import { PreferenciasService } from '../preferencias/preferencias.service';
import { EditorDeTema } from './editor-de-tema';

type Montagem = {
  fixture: ComponentFixture<EditorDeTema>;
  raiz: HTMLElement;
  http: HttpTestingController;
  servico: PreferenciasService;
};

function montar(): Montagem {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting()],
  });
  const fixture = TestBed.createComponent(EditorDeTema);
  fixture.detectChanges();

  return {
    fixture,
    raiz: fixture.nativeElement as HTMLElement,
    http: TestBed.inject(HttpTestingController),
    servico: TestBed.inject(PreferenciasService),
  };
}

function elemento<T extends HTMLElement>(
  raiz: HTMLElement,
  seletor: string,
): T {
  const achado = raiz.querySelector<T>(seletor);
  if (!achado) {
    throw new Error(`Não achei ${seletor}.`);
  }
  return achado;
}

function escolherTema(m: Montagem, nome: string): void {
  elemento<HTMLButtonElement>(m.raiz, `[data-tema="${nome}"]`).click();
  m.fixture.detectChanges();
}

function salvar(m: Montagem): HTMLButtonElement {
  return elemento<HTMLButtonElement>(m.raiz, '[data-acao="salvar"]');
}

describe('EditorDeTema', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('style');
  });

  it('mostra os quatro temas prontos, com o da conta marcado', () => {
    const m = montar();
    const radios = Array.from(
      m.raiz.querySelectorAll<HTMLElement>('[data-tema]'),
    );

    expect(radios.map((r) => r.dataset['tema'])).toEqual([
      'nebula',
      'eclipse',
      'dawn',
      'vacuum',
    ]);
    expect(
      radios.find((r) => r.getAttribute('aria-checked') === 'true')?.dataset[
        'tema'
      ],
    ).toBe('nebula');
  });

  it('cada miniatura é desenhada com os tokens do próprio tema', () => {
    const m = montar();
    const dawn = elemento(m.raiz, '[data-tema="dawn"]');

    expect(dawn.getAttribute('style')).toContain('#f6f1ea');
  });

  it('sem alteração, não há o que salvar', () => {
    const m = montar();

    expect(salvar(m).disabled).toBe(true);
  });

  it('escolher um tema mostra a prévia no app inteiro, sem salvar', () => {
    const m = montar();

    escolherTema(m, 'dawn');

    expect(m.servico.temaVigente().sementes.fundo).toBe('#f6f1ea');
    expect(m.servico.preferencias().tema).toEqual(TEMA_PADRAO);
    expect(
      document.documentElement.style.getPropertyValue('--surface-base'),
    ).toBe('#f6f1ea');
    expect(salvar(m).disabled).toBe(false);
  });

  it('salvar envia só o tema, e avisa quando dá certo', () => {
    const m = montar();
    escolherTema(m, 'dawn');

    salvar(m).click();

    const pedido = m.http.expectOne('/api/preferencias');
    expect(pedido.request.method).toBe('PATCH');
    expect(Object.keys(pedido.request.body as object)).toEqual(['tema']);
    expect((pedido.request.body as { tema: { base: string } }).tema.base).toBe(
      'dawn',
    );
  });

  it('desfazer volta ao tema da conta e apaga a prévia', () => {
    const m = montar();
    escolherTema(m, 'dawn');

    elemento<HTMLButtonElement>(m.raiz, '[data-acao="desfazer"]').click();
    m.fixture.detectChanges();

    expect(m.servico.temaVigente()).toEqual(TEMA_PADRAO);
    expect(salvar(m).disabled).toBe(true);
  });

  it('restaurar o padrão leva o rascunho ao tema padrão, e ainda pede para salvar', () => {
    const m = montar();
    escolherTema(m, 'vacuum');

    elemento<HTMLButtonElement>(m.raiz, '[data-acao="restaurar"]').click();
    m.fixture.detectChanges();

    expect(m.servico.temaVigente()).toEqual(TEMA_PADRAO);
  });

  it('os cantos e as estrelas entram no rascunho', () => {
    const m = montar();
    const cantos = elemento<HTMLInputElement>(m.raiz, '#cantos');

    cantos.value = '14';
    cantos.dispatchEvent(new Event('input'));
    m.fixture.detectChanges();

    expect(m.servico.temaVigente().forma.cantos).toBe(14);
    expect(document.documentElement.style.getPropertyValue('--r')).toBe('14px');
  });

  it('mostra o aviso do motor junto às cores quando ele ajusta uma semente', () => {
    const m = montar();
    const fundo = elemento<HTMLInputElement>(m.raiz, '#fundo');

    fundo.value = '#808080';
    fundo.dispatchEvent(new Event('input'));
    m.fixture.detectChanges();

    expect(m.raiz.querySelector('.avisos-do-motor')?.textContent).toContain(
      'Ajustamos',
    );
  });

  it('sair sem salvar desfaz a prévia', () => {
    const m = montar();
    escolherTema(m, 'dawn');

    m.fixture.destroy();

    expect(m.servico.temaVigente()).toEqual(TEMA_PADRAO);
    expect(
      document.documentElement.style.getPropertyValue('--surface-base'),
    ).toBe('#0b0d17');
  });
});

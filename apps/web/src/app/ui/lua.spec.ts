import { TestBed } from '@angular/core/testing';
import { caminhoDaLua, type Hemisferio } from '@norbit/domain';
import { Lua, RAIO_DO_DESENHO } from './lua';

function montar(entradas: {
  fase: number;
  tamanho?: number;
  hemisferio?: Hemisferio;
}): { raiz: HTMLElement; mudar: (fase: number) => void } {
  const fixture = TestBed.createComponent(Lua);
  fixture.componentRef.setInput('fase', entradas.fase);
  if (entradas.tamanho !== undefined) {
    fixture.componentRef.setInput('tamanho', entradas.tamanho);
  }
  if (entradas.hemisferio !== undefined) {
    fixture.componentRef.setInput('hemisferio', entradas.hemisferio);
  }
  fixture.detectChanges();

  return {
    raiz: fixture.nativeElement as HTMLElement,
    mudar: (fase) => {
      fixture.componentRef.setInput('fase', fase);
      fixture.detectChanges();
    },
  };
}

function caminho(raiz: HTMLElement): string | null {
  return raiz.querySelector('path.luz')?.getAttribute('d') ?? null;
}

describe('Lua', () => {
  it('desenha o disco e a parte iluminada', () => {
    const { raiz } = montar({ fase: 0.1 });

    expect(raiz.querySelector('circle.disco')).not.toBeNull();
    expect(caminho(raiz)).toBe(caminhoDaLua(0.1, RAIO_DO_DESENHO, 'sul'));
  });

  it('abre no hemisfério sul, o do produto', () => {
    const { raiz } = montar({ fase: 0.1 });

    expect(caminho(raiz)).toBe(caminhoDaLua(0.1, RAIO_DO_DESENHO, 'sul'));
  });

  it('o hemisfério norte desenha o espelho', () => {
    const sul = caminho(montar({ fase: 0.1, hemisferio: 'sul' }).raiz);
    const norte = caminho(montar({ fase: 0.1, hemisferio: 'norte' }).raiz);

    expect(norte).toBe(caminhoDaLua(0.1, RAIO_DO_DESENHO, 'norte'));
    expect(norte).not.toBe(sul);
  });

  it('o tamanho vira largura e altura em pixels, e não muda o desenho', () => {
    const pequena = montar({ fase: 0.3, tamanho: 12 }).raiz;
    const grande = montar({ fase: 0.3, tamanho: 34 }).raiz;

    const svg = grande.querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('34');
    expect(svg?.getAttribute('height')).toBe('34');
    expect(pequena.querySelector('svg')?.getAttribute('width')).toBe('12');
    expect(caminho(pequena)).toBe(caminho(grande));
  });

  it('tem 14 pixels por padrão', () => {
    const { raiz } = montar({ fase: 0.3 });

    expect(raiz.querySelector('svg')?.getAttribute('width')).toBe('14');
  });

  it('diz a fase e a iluminação a quem não vê', () => {
    const { raiz } = montar({ fase: 0.5 });
    const svg = raiz.querySelector('svg');

    expect(svg?.getAttribute('role')).toBe('img');
    expect(svg?.getAttribute('aria-label')).toBe('Lua cheia, 100% iluminada');
  });

  it('acompanha a fase quando ela muda', () => {
    const { raiz, mudar } = montar({ fase: 0.1 });
    const antes = caminho(raiz);

    mudar(0.4);

    expect(caminho(raiz)).not.toBe(antes);
    expect(raiz.querySelector('svg')?.getAttribute('aria-label')).toBe(
      'Gibosa crescente, 90% iluminada',
    );
  });
});

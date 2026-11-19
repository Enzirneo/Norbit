import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { TEMA_PADRAO, type Tema } from '@norbit/contracts';
import { PreferenciasService } from './preferencias.service';

const CLARO: Tema = {
  ...TEMA_PADRAO,
  sementes: { ...TEMA_PADRAO.sementes, fundo: '#f6f1ea' },
  forma: { cantos: 12, estrelas: false, lua: false, hemisferio: 'norte' },
};

function variavel(nome: string): string {
  return document.documentElement.style.getPropertyValue(nome);
}

describe('PreferenciasService: prévia do tema', () => {
  let servico: PreferenciasService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient()] });
    servico = TestBed.inject(PreferenciasService);
  });

  afterEach(() => {
    document.documentElement.removeAttribute('style');
  });

  it('sem prévia, o tema vigente é o da conta', () => {
    expect(servico.temaVigente()).toEqual(TEMA_PADRAO);
    expect(servico.forma()).toEqual(TEMA_PADRAO.forma);
  });

  it('uma prévia vira o tema vigente e a forma, sem tocar no que é da conta', () => {
    servico.definirPrevia(CLARO);

    expect(servico.temaVigente()).toEqual(CLARO);
    expect(servico.forma().hemisferio).toBe('norte');
    expect(servico.preferencias().tema).toEqual(TEMA_PADRAO);
  });

  it('a prévia vai para a página na hora', () => {
    servico.definirPrevia(CLARO);

    expect(variavel('--surface-base')).toBe('#f6f1ea');
    expect(variavel('--r')).toBe('12px');
  });

  it('a prévia não vai para o cache: sair sem salvar não deixa rastro', () => {
    localStorage.removeItem('norbit:aparencia');

    servico.definirPrevia(CLARO);

    expect(localStorage.getItem('norbit:aparencia')).toBeNull();
  });

  it('limpar a prévia devolve a aparência da conta', () => {
    servico.definirPrevia(CLARO);

    servico.definirPrevia(null);

    expect(servico.temaVigente()).toEqual(TEMA_PADRAO);
    expect(variavel('--surface-base')).toBe('#0b0d17');
    expect(variavel('--r')).toBe('6px');
  });
});

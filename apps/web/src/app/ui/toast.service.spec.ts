import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DURACAO_DO_PERIGO_MS,
  DURACAO_PADRAO_MS,
  LIMITE_DE_TOASTS,
  ToastService,
} from './toast.service';

describe('ToastService', () => {
  let servico: ToastService;

  beforeEach(() => {
    vi.useFakeTimers();
    servico = TestBed.inject(ToastService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('começa sem nenhum', () => {
    expect(servico.toasts()).toEqual([]);
  });

  it('mostra um aviso de sucesso por padrão', () => {
    servico.mostrar('Perfil salvo.');

    expect(servico.toasts()).toEqual([
      expect.objectContaining({ texto: 'Perfil salvo.', tipo: 'sucesso' }),
    ]);
  });

  it('aceita o tipo', () => {
    servico.mostrar('Não deu', { tipo: 'perigo' });

    expect(servico.toasts()[0].tipo).toBe('perigo');
  });

  it('some sozinho depois do tempo padrão, e não antes', () => {
    servico.mostrar('Perfil salvo.');

    vi.advanceTimersByTime(DURACAO_PADRAO_MS - 1);
    expect(servico.toasts()).toHaveLength(1);

    vi.advanceTimersByTime(1);
    expect(servico.toasts()).toHaveLength(0);
  });

  it('um perigo fica mais tempo: quem erra precisa ler', () => {
    expect(DURACAO_DO_PERIGO_MS).toBeGreaterThan(DURACAO_PADRAO_MS);

    servico.mostrar('Não deu', { tipo: 'perigo' });
    vi.advanceTimersByTime(DURACAO_PADRAO_MS);

    expect(servico.toasts()).toHaveLength(1);

    vi.advanceTimersByTime(DURACAO_DO_PERIGO_MS - DURACAO_PADRAO_MS);
    expect(servico.toasts()).toHaveLength(0);
  });

  it('aceita uma duração própria', () => {
    servico.mostrar('Rápido', { duracaoMs: 500 });

    vi.advanceTimersByTime(500);

    expect(servico.toasts()).toHaveLength(0);
  });

  it('dispensar tira na hora, e o tempo dele não derruba o seguinte', () => {
    servico.mostrar('Um');
    const [primeiro] = servico.toasts();
    vi.advanceTimersByTime(1000);
    servico.mostrar('Dois');

    servico.dispensar(primeiro.id);

    expect(servico.toasts().map((t) => t.texto)).toEqual(['Dois']);
    // O tempo do primeiro passa: o segundo continua até o seu próprio fim.
    vi.advanceTimersByTime(DURACAO_PADRAO_MS - 1000);
    expect(servico.toasts().map((t) => t.texto)).toEqual(['Dois']);
  });

  it('dispensar um que não existe não faz nada', () => {
    servico.mostrar('Um');

    servico.dispensar(999);

    expect(servico.toasts()).toHaveLength(1);
  });

  it('o mesmo aviso de novo reinicia o tempo, em vez de empilhar cópias', () => {
    servico.mostrar('Preferências salvas.');
    vi.advanceTimersByTime(DURACAO_PADRAO_MS - 1000);

    servico.mostrar('Preferências salvas.');

    expect(servico.toasts()).toHaveLength(1);
    // Passou o tempo do primeiro, mas o segundo reiniciou a contagem.
    vi.advanceTimersByTime(1500);
    expect(servico.toasts()).toHaveLength(1);

    vi.advanceTimersByTime(DURACAO_PADRAO_MS);
    expect(servico.toasts()).toHaveLength(0);
  });

  it('o mesmo texto com outro tipo é outro aviso', () => {
    servico.mostrar('Pronto', { tipo: 'sucesso' });
    servico.mostrar('Pronto', { tipo: 'perigo' });

    expect(servico.toasts()).toHaveLength(2);
  });

  it('mostra no máximo o limite: o mais antigo sai quando chega um a mais', () => {
    for (let i = 1; i <= LIMITE_DE_TOASTS + 1; i++) {
      servico.mostrar(`Aviso ${i}`);
    }

    const textos = servico.toasts().map((t) => t.texto);
    expect(textos).toHaveLength(LIMITE_DE_TOASTS);
    expect(textos).not.toContain('Aviso 1');
    expect(textos).toContain(`Aviso ${LIMITE_DE_TOASTS + 1}`);
  });

  it('cada aviso tem um identificador próprio', () => {
    servico.mostrar('Um');
    servico.mostrar('Dois');

    const [a, b] = servico.toasts();
    expect(a.id).not.toBe(b.id);
  });
});

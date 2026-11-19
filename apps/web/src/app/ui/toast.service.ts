/**
 * Os toasts: confirmações e falhas curtas que somem sozinhas.
 *
 * Substituem as linhas "Salvando… / Perfil salvo." coladas no cabeçalho de cada
 * tela: a confirmação aparece no mesmo lugar em qualquer página, e a tela não
 * precisa reservar espaço para ela.
 */
import { Injectable, signal } from '@angular/core';
import type { TipoDeAviso } from './aviso';

export const DURACAO_PADRAO_MS = 4000;
/** Quem errou precisa de tempo para ler. */
export const DURACAO_DO_PERIGO_MS = 8000;
export const LIMITE_DE_TOASTS = 3;

export type Toast = {
  readonly id: number;
  readonly texto: string;
  readonly tipo: TipoDeAviso;
};

export type OpcoesDoToast = {
  readonly tipo?: TipoDeAviso;
  readonly duracaoMs?: number;
};

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly lista = signal<readonly Toast[]>([]);
  private readonly relogios = new Map<number, ReturnType<typeof setTimeout>>();
  private proximoId = 1;

  readonly toasts = this.lista.asReadonly();

  mostrar(texto: string, opcoes: OpcoesDoToast = {}): void {
    const tipo = opcoes.tipo ?? 'sucesso';
    const duracao =
      opcoes.duracaoMs ??
      (tipo === 'perigo' ? DURACAO_DO_PERIGO_MS : DURACAO_PADRAO_MS);

    // O mesmo aviso de novo reinicia o tempo em vez de empilhar cópias: salvar
    // três vezes seguidas não deve encher a tela de "Preferências salvas.".
    const repetido = this.lista().find(
      (t) => t.texto === texto && t.tipo === tipo,
    );
    if (repetido) {
      this.agendar(repetido.id, duracao);
      return;
    }

    const id = this.proximoId++;
    const novos = [...this.lista(), { id, texto, tipo }];
    for (const excedente of novos.slice(
      0,
      Math.max(0, novos.length - LIMITE_DE_TOASTS),
    )) {
      this.limpar(excedente.id);
    }
    this.lista.set(novos.slice(-LIMITE_DE_TOASTS));
    this.agendar(id, duracao);
  }

  dispensar(id: number): void {
    this.limpar(id);
    this.lista.update((l) => l.filter((t) => t.id !== id));
  }

  private agendar(id: number, duracao: number): void {
    this.limpar(id);
    this.relogios.set(
      id,
      setTimeout(() => this.dispensar(id), duracao),
    );
  }

  private limpar(id: number): void {
    clearTimeout(this.relogios.get(id));
    this.relogios.delete(id);
  }
}

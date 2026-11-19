/**
 * Os temas que já vêm prontos, como sementes.
 *
 * São só ponto de partida: a pessoa escolhe um e edita as sementes à vontade.
 * `nebula` é exatamente o padrão que o app tem hoje.
 */
import type { Sementes } from './sementes';

export const TEMAS_PRONTOS = {
  nebula: { fundo: '#0b0d17', destaque: '#6d7cff', contraste: 'normal' },
  eclipse: { fundo: '#140a1f', destaque: '#ff6b8a', contraste: 'normal' },
  dawn: { fundo: '#f6f1ea', destaque: '#5b4bd6', contraste: 'normal' },
  vacuum: { fundo: '#000000', destaque: '#e8eaf2', contraste: 'alto' },
} as const satisfies Record<string, Sementes>;

export type NomeDeTemaPronto = keyof typeof TEMAS_PRONTOS;

/** Só o fundo: para a pessoa trocar o ambiente sem mexer no destaque. */
export const FUNDOS_PRONTOS = {
  noite: '#0b0d17',
  vazio: '#000000',
  aurora: '#06141b',
  eclipse: '#140a1f',
} as const;

export type NomeDeFundoPronto = keyof typeof FUNDOS_PRONTOS;

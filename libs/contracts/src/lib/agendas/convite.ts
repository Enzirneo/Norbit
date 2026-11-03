/**
 * Contratos dos convites para uma agenda.
 */
import { z } from 'zod';
import { email } from '../auth/cadastro';
import type { PapelNaAgenda } from './agenda';

export const criarConviteSchema = z
  .object({
    /**
     * Com e-mail: o convite vale só para a conta desse endereço, e uma vez.
     * Sem e-mail: convite por link, que serve a qualquer conta até `usosMaximos`.
     */
    email: email.optional(),
    // O dono não é convidável: posse se transfere, não se concede por link.
    papel: z.enum(['EDITOR', 'CONTRIBUTOR', 'VIEWER']),
    // Um mês de teto: um convite que vale para sempre é uma credencial que
    // ninguém lembra que existe.
    validadeDias: z.number().int().min(1).max(30).default(7),
    /** Só faz sentido no convite por link; no por e-mail o uso é sempre um. */
    usosMaximos: z.number().int().min(1).max(100).optional(),
  })
  .strip();

export type CriarConvite = z.infer<typeof criarConviteSchema>;

/** Um convite como o painel do dono o mostra. Nunca traz o token. */
export type ConviteVisivel = {
  readonly id: string;
  /** Nulo no convite por link. */
  readonly email: string | null;
  readonly papel: PapelNaAgenda;
  readonly expiraEm: string;
  readonly usosMaximos: number | null;
  readonly usos: number;
  readonly criadoEm: string;
};

/**
 * O resultado de criar um convite.
 *
 * O `link` só existe **agora**: o banco guarda apenas o hash do token, então
 * ninguém — nem o dono, numa segunda consulta — consegue recuperá-lo depois. Quem
 * perder o link de um convite por link revoga e cria outro.
 */
export type ConviteCriado = {
  readonly convite: ConviteVisivel;
  readonly link: string;
};

/** O que quem recebeu o link vê antes de aceitar. */
export type PrevisaoDeConvite = {
  readonly agenda: { readonly nome: string; readonly cor: string };
  readonly convidadoPor: string;
  readonly papel: PapelNaAgenda;
  /** O e-mail a que o convite se destina; nulo no convite por link. */
  readonly paraEmail: string | null;
};

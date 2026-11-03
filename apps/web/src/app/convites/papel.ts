/**
 * Os papéis como a interface os chama.
 *
 * A matriz de **o que cada papel pode** vive em `libs/domain`. Aqui só há o
 * vocabulário da tela e a descrição de uma linha que ajuda a escolher.
 */
import type { PapelNaAgenda } from '@norbit/contracts';

export type PapelConvidavel = Exclude<PapelNaAgenda, 'OWNER'>;

const ROTULOS: Readonly<Record<PapelNaAgenda, string>> = {
  OWNER: 'Dono',
  EDITOR: 'Editor',
  CONTRIBUTOR: 'Colaborador',
  VIEWER: 'Leitor',
};

export function rotuloDoPapel(papel: PapelNaAgenda): string {
  return ROTULOS[papel];
}

/**
 * Sem o dono, de propósito: a API não o aceita num convite, e oferecê-lo na
 * lista só levaria a um erro depois de a pessoa ter escolhido.
 */
export const PAPEIS_CONVIDAVEIS: readonly {
  readonly valor: PapelConvidavel;
  readonly rotulo: string;
  readonly descricao: string;
}[] = [
  {
    valor: 'EDITOR',
    rotulo: ROTULOS.EDITOR,
    descricao: 'Cria, altera e apaga qualquer evento da agenda.',
  },
  {
    valor: 'CONTRIBUTOR',
    rotulo: ROTULOS.CONTRIBUTOR,
    descricao: 'Cria eventos e mexe nos próprios.',
  },
  {
    valor: 'VIEWER',
    rotulo: ROTULOS.VIEWER,
    descricao: 'Só vê a agenda.',
  },
];

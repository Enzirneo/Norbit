/**
 * Contratos de entrada das agendas.
 *
 * Como em `auth/cadastro.ts`, os schemas vivem aqui para que o formulário do
 * Angular valide com exatamente a mesma regra que a API aplica.
 */
import { z } from 'zod';
import { corHex, fusoIana } from './comum';

/**
 * Os campos, uma vez, **sem valor padrão**.
 *
 * O padrão é aplicado só no schema de criação. Se ele estivesse aqui, o schema
 * de atualização herdaria o padrão e um PATCH sem `color` reescreveria a cor
 * para o azul — o clássico "editei o nome e a agenda mudou de cor".
 */
const campos = {
  name: z.string().trim().min(1, 'A agenda precisa de um nome.').max(80),
  description: z.string().trim().max(500).nullable(),
  // Só muda como a agenda é apresentada; o compartilhamento de verdade são os
  // membros.
  kind: z.enum(['PERSONAL', 'SHARED']),
  color: corHex,
  // Emoji ou nome de ícone. O limite é generoso de propósito: emoji composto
  // (bandeira, família) gasta vários pontos de código.
  icon: z.string().trim().max(40).nullable(),
  timeZone: fusoIana,
};

export const criarAgendaSchema = z
  .object({
    ...campos,
    description: campos.description.optional(),
    icon: campos.icon.optional(),
    // Os padrões repetem os do schema do Prisma de propósito: assim a API
    // responde com o valor efetivo em vez de `undefined`, e quem lê o contrato
    // sabe o que vai acontecer sem abrir o schema do banco.
    kind: campos.kind.default('PERSONAL'),
    color: campos.color.default('#6d7cff'),
    // Ausente herda o fuso de quem está criando — decidido no serviço, que é
    // quem conhece o usuário.
    timeZone: campos.timeZone.optional(),
  })
  // Explícito porque é decisão de segurança: campo não declarado é descartado,
  // então `ownerId` ou `isDefault` no corpo nunca chegam ao serviço.
  .strip();

export const atualizarAgendaSchema = z
  .object({ ...campos, arquivada: z.boolean() })
  .partial()
  .strip()
  // Um PATCH vazio não é erro de dados, mas também não é operação: recusar
  // evita gravar `updatedAt` e uma linha de atividade por nada.
  .refine(
    (dados) => Object.keys(dados).length > 0,
    'Informe ao menos um campo para alterar.',
  );

export type CriarAgenda = z.infer<typeof criarAgendaSchema>;
export type AtualizarAgenda = z.infer<typeof atualizarAgendaSchema>;

/**
 * O papel de um membro, igual ao enum `CalendarRole` do banco.
 *
 * A matriz de **o que cada papel pode** não está aqui: é lógica, vive em
 * `libs/domain/src/lib/agendas/permissoes.ts` e é testada lá. Aqui é só a lista
 * de valores que a interface precisa conhecer para renderizar o seletor.
 */
export const papelSchema = z.enum(['OWNER', 'EDITOR', 'CONTRIBUTOR', 'VIEWER']);

export const definirPapelSchema = z
  .object({
    // Promover alguém a OWNER é transferência de posse, e isso não é uma
    // alteração de papel: exige confirmação própria e troca `Calendar.ownerId`.
    // Por isso o papel de dono não é atribuível por esta rota.
    papel: z.enum(['EDITOR', 'CONTRIBUTOR', 'VIEWER']),
  })
  .strip();

export type DefinirPapel = z.infer<typeof definirPapelSchema>;

export type PapelNaAgenda = z.infer<typeof papelSchema>;

/** O que a API devolve para uma agenda. */
export type AgendaVisivel = {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly kind: 'PERSONAL' | 'SHARED';
  readonly color: string;
  readonly icon: string | null;
  readonly timeZone: string;
  readonly isDefault: boolean;
  readonly arquivada: boolean;
  /** O papel de quem pediu — é com ele que a interface decide o que mostrar. */
  readonly papel: PapelNaAgenda;
  readonly ownerId: string;
};

/** Um membro como a lista da agenda o mostra. */
export type MembroVisivel = {
  readonly userId: string;
  readonly handle: string;
  readonly displayName: string;
  readonly avatarUrl: string | null;
  readonly papel: PapelNaAgenda;
  /** ISO-8601, para a interface formatar no fuso de quem lê. */
  readonly desde: string;
};

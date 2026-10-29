/**
 * A ponte entre o banco e a matriz de autorização.
 *
 * Resolve **qual** é o papel de quem está pedindo (isso depende do banco) e
 * aplica o veredito de `libs/domain`. Toda rota de agenda e de evento passa por
 * aqui: é o único lugar do servidor que decide acesso, e é de propósito que seja
 * um só — autorização espalhada diverge, e divergência de autorização aparece
 * como vazamento de dado.
 */
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  podeNaAgenda,
  podeNoEvento,
  type AcaoDeAgenda,
  type AcaoDeEvento,
  type Papel,
} from '@norbit/domain';
import { PrismaService, type Calendar, type CalendarRole } from '@norbit/db';

/**
 * Agenda inexistente e agenda de outra pessoa dão a **mesma** resposta.
 *
 * Responder 403 para uma agenda que existe e 404 para uma que não existe
 * transforma a rota num oráculo: qualquer um descobre quais identificadores são
 * reais varrendo a API. É o mesmo raciocínio da mensagem única de credencial
 * inválida em `auth.service.ts`.
 *
 * Para quem **é** membro mas não tem o papel necessário, o 403 é correto e
 * informativo: a existência da agenda já não é segredo para ele.
 */
const NAO_ENCONTRADA = 'Agenda não encontrada.';

export type AcessoAAgenda = {
  readonly agenda: Calendar;
  readonly papel: Papel;
};

@Injectable()
export class AcessoService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Abre a agenda já autorizada para a ação, numa única consulta.
   *
   * Devolver a agenda junto não é conveniência: separar em "busca" e "autoriza"
   * convidaria quem chama a usar a primeira sem a segunda.
   */
  async abrir(entrada: {
    readonly calendarId: string;
    readonly userId: string;
    readonly acao: AcaoDeAgenda;
  }): Promise<AcessoAAgenda> {
    const agenda = await this.prisma.calendar.findFirst({
      where: { id: entrada.calendarId, deletedAt: null },
      include: { members: { where: { userId: entrada.userId } } },
    });

    const papel = agenda ? papelNa(agenda, entrada.userId) : null;
    if (!agenda || papel === null) {
      throw new NotFoundException(NAO_ENCONTRADA);
    }

    if (!podeNaAgenda(papel, entrada.acao)) {
      throw new ForbiddenException(recusa(entrada.acao));
    }

    return { agenda, papel };
  }

  /**
   * As agendas que esta pessoa vê, com o papel dela em cada uma.
   *
   * O `OR` do `where` e o descarte no `flatMap` filtram a mesma coisa, e isso é
   * intencional — mas os dois **não** têm o mesmo papel, e confundi-los é como
   * se perde uma garantia:
   *
   * - o filtro do `where` é **desempenho**: sem ele a consulta traria toda
   *   agenda do banco para a memória antes de descartar;
   * - o descarte por `papelNa` é **correção**: é ele que decide o acesso.
   *
   * Medido por mutação: remover o `OR` não quebra nenhum teste, porque o
   * `flatMap` segura o resultado. Remover o descarte quebra na hora. Está
   * escrito aqui para que ninguém "simplifique" o `where` achando que ele é a
   * fronteira de segurança — nem o remova achando que é redundante.
   */
  async minhasAgendas(userId: string): Promise<AcessoAAgenda[]> {
    const agendas = await this.prisma.calendar.findMany({
      where: {
        deletedAt: null,
        OR: [{ ownerId: userId }, { members: { some: { userId } } }],
      },
      include: { members: { where: { userId } } },
      // A agenda padrão primeiro, e o resto na ordem que o membro escolheu na
      // barra lateral.
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });

    return agendas.flatMap((agenda) => {
      const papel = papelNa(agenda, userId);
      return papel === null ? [] : [{ agenda, papel }];
    });
  }

  /**
   * O veredito sobre um evento, que também depende de quem o criou.
   *
   * Síncrono de propósito: quem chama já tem o papel e o evento em mão, e uma
   * assinatura `async` aqui sugeriria uma consulta que não existe.
   */
  exigirNoEvento(entrada: {
    readonly papel: Papel;
    readonly acao: AcaoDeEvento;
    readonly ehAutor: boolean;
  }): void {
    if (!podeNoEvento(entrada)) {
      throw new ForbiddenException(recusa(entrada.acao));
    }
  }
}

/**
 * O dono é dono pelo campo `ownerId`, não pela linha de membro.
 *
 * Assim a transferência de posse é a troca de um campo, e o dono não consegue
 * se trancar fora da própria agenda apagando a própria linha de membro.
 */
function papelNa(
  agenda: Calendar & { members: { role: CalendarRole }[] },
  userId: string,
): Papel | null {
  if (agenda.ownerId === userId) {
    return 'OWNER';
  }

  const membro = agenda.members[0];
  return membro ? paraPapel(membro.role) : null;
}

/**
 * As duas conversões existem para travar os dois enums em tempo de compilação.
 *
 * `libs/domain` não conhece o Prisma (ver as fronteiras em `eslint.config.mjs`),
 * então `Papel` é uma segunda declaração dos mesmos quatro valores. Estas duas
 * funções só compilam se cada união for atribuível à outra — ou seja, se as
 * duas listas forem idênticas. Acrescentar um papel ao `schema.prisma` e
 * esquecer a matriz passa a quebrar o build, em vez de virar uma permissão
 * decidida por omissão em runtime.
 */
function paraPapel(role: CalendarRole): Papel {
  return role;
}

export function paraRole(papel: Papel): CalendarRole {
  return papel;
}

function recusa(acao: AcaoDeAgenda | AcaoDeEvento): string {
  const texto: Record<AcaoDeAgenda | AcaoDeEvento, string> = {
    ver: 'Você não tem acesso a esta agenda.',
    'criar-evento': 'Seu papel nesta agenda não permite criar eventos.',
    'editar-agenda': 'Só quem é dono pode alterar esta agenda.',
    'excluir-agenda': 'Só quem é dono pode excluir esta agenda.',
    'gerenciar-membros': 'Só quem é dono pode gerenciar os membros.',
    'editar-evento': 'Você só pode editar os eventos que você criou.',
    'excluir-evento': 'Você só pode excluir os eventos que você criou.',
  };

  return texto[acao];
}

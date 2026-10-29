/**
 * Os eventos: criar, alterar, excluir, e consultar um intervalo.
 *
 * A consulta é a operação que define o produto, e ela não é um `findMany`: uma
 * série recorrente é **uma linha** no banco, e o que a tela precisa são as
 * ocorrências dela no intervalo pedido. Quem expande é `libs/domain` (ver
 * `docs/08-recorrencia.md`); aqui acontece a parte que depende do banco —
 * escolher quais linhas podem ter ocorrência no intervalo, e juntar as exceções
 * de cada série antes de expandir.
 */
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  AtualizarEvento,
  ConsultaDeEventos,
  CriarEvento,
  EventoVisivel,
  OcorrenciaVisivel,
} from '@norbit/contracts';
import { expandir, lerRrule } from '@norbit/domain';
import { PrismaService, type Calendar, type Event } from '@norbit/db';
import { uuidv7 } from 'uuidv7';
import { AcessoService } from '../agendas/acesso.service';
import { paraEventoVisivel, paraOcorrenciaVisivel } from './visivel';
import { intervaloGravado } from './intervalo';

@Injectable()
export class EventosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acesso: AcessoService,
  ) {}

  /**
   * As ocorrências do intervalo, de todas as agendas visíveis.
   *
   * Um identificador de agenda que a pessoa não vê é **ignorado**, não recusado:
   * responder 403 ou 404 por agenda confirmaria quais identificadores existem,
   * e a tela de calendário não tem o que fazer com esse erro de qualquer forma.
   */
  async consultar(
    userId: string,
    consulta: ConsultaDeEventos,
  ): Promise<OcorrenciaVisivel[]> {
    const visiveis = await this.agendasPermitidas(userId, consulta.agendas);
    if (visiveis.length === 0) {
      return [];
    }

    const linhas = await this.linhasComOcorrenciaPossivel(
      visiveis,
      userId,
      consulta,
    );
    const excecoes = await this.excecoesDasSeries(linhas);

    return linhas
      .flatMap((linha) => ocorrenciasDe(linha, consulta, excecoes))
      .sort((a, b) => a.inicio.localeCompare(b.inicio));
  }

  async criar(entrada: {
    readonly userId: string;
    readonly calendarId: string;
    readonly dados: CriarEvento;
  }): Promise<EventoVisivel> {
    const { agenda } = await this.acesso.abrir({
      calendarId: entrada.calendarId,
      userId: entrada.userId,
      acao: 'criar-evento',
    });

    const regra = regraValidada(entrada.dados.recurrenceRule);
    const { dados } = entrada;
    const periodo = intervaloGravado({
      inicio: dados.startsAt,
      fim: dados.endsAt,
      diaInteiro: dados.isAllDay,
      fuso: dados.timeZone ?? agenda.timeZone,
    });

    const criado = await this.prisma.event.create({
      data: {
        id: uuidv7(),
        calendarId: agenda.id,
        createdById: entrada.userId,
        title: dados.title,
        description: dados.description ?? null,
        location: dados.location ?? null,
        color: dados.color ?? null,
        startsAt: periodo.inicio,
        endsAt: periodo.fim,
        isAllDay: dados.isAllDay,
        timeZone: dados.timeZone ?? agenda.timeZone,
        status: dados.status,
        visibility: dados.visibility,
        recurrenceRule: dados.recurrenceRule ?? null,
        // Cópia desnormalizada do `UNTIL`, para que o índice possa descartar
        // séries já encerradas sem expandi-las.
        recurrenceUntil: regra?.ate ?? null,
      },
    });

    return paraEventoVisivel(criado);
  }

  /**
   * Altera o evento, completando o que o schema não consegue verificar.
   *
   * `atualizarEventoSchema` aceita subconjunto, então um PATCH que move só o
   * `endsAt` passa por ele — não há com o que comparar sem a linha gravada. A
   * comparação acontece aqui, e a CHECK constraint do Postgres fica atrás como
   * garantia (ver o fim de `prisma/schema.prisma`).
   */
  async atualizar(entrada: {
    readonly userId: string;
    readonly eventId: string;
    readonly dados: AtualizarEvento;
  }): Promise<EventoVisivel> {
    const { evento } = await this.abrirEvento({
      userId: entrada.userId,
      eventId: entrada.eventId,
      acao: 'editar-evento',
    });

    const { dados } = entrada;
    const combinado = {
      inicio: dados.startsAt ?? evento.startsAt,
      fim: dados.endsAt ?? evento.endsAt,
      diaInteiro: dados.isAllDay ?? evento.isAllDay,
      fuso: dados.timeZone ?? evento.timeZone,
    };

    if (combinado.fim.getTime() < combinado.inicio.getTime()) {
      throw new BadRequestException(
        'O fim do evento não pode vir antes do início.',
      );
    }

    // `undefined` é não mexer; `null` é apagar a regra. Distinguir os dois é o
    // que permite desfazer a recorrência de uma série sem recriar o evento.
    const regra = regraValidada(
      dados.recurrenceRule === undefined
        ? evento.recurrenceRule
        : dados.recurrenceRule,
    );

    const periodo = intervaloGravado(combinado);

    const atualizado = await this.prisma.event.update({
      where: { id: evento.id },
      data: {
        ...dados,
        startsAt: periodo.inicio,
        endsAt: periodo.fim,
        recurrenceUntil: regra?.ate ?? null,
      },
    });

    return paraEventoVisivel(atualizado);
  }

  /** Exclusão lógica da linha — e, numa série, da série inteira. */
  async remover(userId: string, eventId: string): Promise<void> {
    const { evento } = await this.abrirEvento({
      userId,
      eventId,
      acao: 'excluir-evento',
    });

    await this.prisma.event.update({
      where: { id: evento.id },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * "Excluir só este": a data entra em `excludedDates` e a expansão a remove.
   *
   * A ocorrência não existe como linha, então não há o que apagar — o que se
   * grava é a ausência dela. A exclusão é aplicada **depois** da contagem da
   * regra (ver `docs/08-recorrencia.md`), e por isso `COUNT=4` com duas
   * exclusões dá duas ocorrências em vez de empurrar a série para frente.
   */
  async excluirOcorrencia(entrada: {
    readonly userId: string;
    readonly eventId: string;
    readonly inicioOriginal: Date;
  }): Promise<void> {
    const { evento } = await this.abrirEvento({
      userId: entrada.userId,
      eventId: entrada.eventId,
      acao: 'excluir-evento',
    });

    exigirSerie(evento);

    const jaExcluida = evento.excludedDates.some(
      (data) => data.getTime() === entrada.inicioOriginal.getTime(),
    );
    if (jaExcluida) {
      return;
    }

    await this.prisma.event.update({
      where: { id: evento.id },
      data: {
        excludedDates: { push: entrada.inicioOriginal },
      },
    });
  }

  /**
   * "Editar só este": destaca a ocorrência numa linha própria.
   *
   * A linha filha guarda `originalStartsAt`, e é por esse campo que a expansão
   * da série-mãe sabe suprimir a instância substituída — não por `excludedDates`,
   * que é a exclusão. Separar os dois é o que permite desfazer um sem o outro.
   */
  async destacarOcorrencia(entrada: {
    readonly userId: string;
    readonly eventId: string;
    readonly inicioOriginal: Date;
  }): Promise<EventoVisivel> {
    const { evento } = await this.abrirEvento({
      userId: entrada.userId,
      eventId: entrada.eventId,
      acao: 'editar-evento',
    });

    exigirSerie(evento);

    const ocorrencia = this.ocorrenciaExata(evento, entrada.inicioOriginal);

    const filha = await this.prisma.event.create({
      data: {
        ...semIdentidade(evento),
        id: uuidv7(),
        createdById: entrada.userId,
        startsAt: ocorrencia.inicio,
        endsAt: ocorrencia.fim,
        // A filha não é uma série: ela é uma ocorrência só.
        recurrenceRule: null,
        recurrenceUntil: null,
        excludedDates: [],
        recurrenceParentId: evento.id,
        originalStartsAt: ocorrencia.inicioOriginal,
      },
    });

    return paraEventoVisivel(filha);
  }

  // ─── privados ──────────────────────────────────────────────────────────────

  private async abrirEvento(entrada: {
    readonly userId: string;
    readonly eventId: string;
    readonly acao: 'editar-evento' | 'excluir-evento';
  }): Promise<{ evento: Event; agenda: Calendar }> {
    const evento = await this.prisma.event.findFirst({
      where: { id: entrada.eventId, deletedAt: null },
    });

    if (!evento) {
      throw new NotFoundException('Evento não encontrado.');
    }

    // A autorização é da **agenda**, e por isso passa pelo mesmo `abrir` de
    // todas as outras rotas. Um evento cuja agenda a pessoa não vê devolve o
    // 404 da agenda, e não um 403 que confirmaria a existência do evento.
    const { agenda, papel } = await this.acesso.abrir({
      calendarId: evento.calendarId,
      userId: entrada.userId,
      acao: 'ver',
    });

    this.acesso.exigirNoEvento({
      papel,
      acao: entrada.acao,
      ehAutor: evento.createdById === entrada.userId,
    });

    return { evento, agenda };
  }

  private async agendasPermitidas(
    userId: string,
    pedidas: readonly string[] | undefined,
  ): Promise<string[]> {
    const minhas = await this.acesso.minhasAgendas(userId);
    const ids = minhas.map(({ agenda }) => agenda.id);

    return pedidas ? ids.filter((id) => pedidas.includes(id)) : ids;
  }

  /**
   * As linhas que podem ter ocorrência no intervalo.
   *
   * Dois filtros em `AND`, e os dois importam por razões diferentes: um é de
   * desempenho (o intervalo), o outro é de privacidade (a visibilidade).
   */
  private async linhasComOcorrenciaPossivel(
    agendas: readonly string[],
    userId: string,
    { de, ate }: ConsultaDeEventos,
  ): Promise<Event[]> {
    return this.prisma.event.findMany({
      where: {
        calendarId: { in: [...agendas] },
        deletedAt: null,
        AND: [
          {
            // `PRIVATE` some para todo mundo menos quem criou — **na consulta**,
            // e não na resposta. Filtrar depois de buscar deixaria o dado passar
            // pela aplicação, e é assim que ele acaba num log de erro ou numa
            // contagem. `INHERITED` segue a visibilidade da agenda, que já é
            // decidida pela filiação.
            OR: [{ visibility: 'INHERITED' }, { createdById: userId }],
          },
          {
            OR: [
              // Evento avulso: o filtro do banco é de propósito mais largo que o
              // da expansão (`endsAt >= de` em vez de `>`), porque pré-filtro que
              // descarta demais perde evento — e `expandir` aplica a borda exata.
              {
                recurrenceRule: null,
                startsAt: { lt: ate },
                endsAt: { gte: de },
              },
              // Série: ela pode ter ocorrência no intervalo desde que tenha
              // começado antes do fim dele e não tenha terminado antes do começo.
              // É o que o índice `[calendarId, recurrenceRule, recurrenceUntil]`
              // atende.
              {
                recurrenceRule: { not: null },
                startsAt: { lt: ate },
                OR: [
                  { recurrenceUntil: null },
                  { recurrenceUntil: { gte: de } },
                ],
              },
            ],
          },
        ],
      },
    });
  }

  /**
   * As ocorrências destacadas de cada série, por `originalStartsAt`.
   *
   * Busca por `recurrenceParentId`, e não pelo intervalo: uma ocorrência movida
   * para fora da janela consultada precisa continuar suprimindo a instância
   * original dentro dela, ou o evento apareceria duas vezes.
   *
   * Inclui as filhas **excluídas**. Quem apagou uma ocorrência já destacada quis
   * que ela desaparecesse; parar de suprimir faria a instância original
   * ressuscitar no lugar dela.
   */
  private async excecoesDasSeries(
    linhas: readonly Event[],
  ): Promise<Map<string, Date[]>> {
    const series = linhas
      .filter((linha) => linha.recurrenceRule !== null)
      .map((linha) => linha.id);

    if (series.length === 0) {
      return new Map();
    }

    const filhas = await this.prisma.event.findMany({
      where: { recurrenceParentId: { in: series } },
      select: { recurrenceParentId: true, originalStartsAt: true },
    });

    const porSerie = new Map<string, Date[]>();
    for (const filha of filhas) {
      if (!filha.recurrenceParentId || !filha.originalStartsAt) {
        continue;
      }

      const atuais = porSerie.get(filha.recurrenceParentId) ?? [];
      atuais.push(filha.originalStartsAt);
      porSerie.set(filha.recurrenceParentId, atuais);
    }

    return porSerie;
  }

  /**
   * Localiza a ocorrência pedida expandindo a série em torno dela.
   *
   * Exigir que o instante seja uma ocorrência de verdade é o que impede uma
   * série de ganhar uma filha numa data que a regra nunca geraria — uma linha
   * que a expansão jamais suprimiria, e que apareceria como um evento fantasma.
   */
  private ocorrenciaExata(
    evento: Event,
    inicioOriginal: Date,
  ): { inicio: Date; fim: Date; inicioOriginal: Date } {
    const MARGEM = 1_000;
    const [ocorrencia] = expandir(paraEventoRecorrente(evento), {
      de: new Date(inicioOriginal.getTime() - MARGEM),
      ate: new Date(inicioOriginal.getTime() + MARGEM),
    });

    if (!ocorrencia) {
      throw new BadRequestException(
        'Essa data não é uma ocorrência desta série.',
      );
    }

    return ocorrencia;
  }
}

function ocorrenciasDe(
  linha: Event,
  { de, ate }: ConsultaDeEventos,
  excecoes: Map<string, Date[]>,
): OcorrenciaVisivel[] {
  const destacadas = excecoes.get(linha.id) ?? [];

  return expandir(
    {
      ...paraEventoRecorrente(linha),
      datasExcluidas: [...linha.excludedDates, ...destacadas],
    },
    { de, ate },
  ).map((ocorrencia) => paraOcorrenciaVisivel(linha, ocorrencia));
}

function paraEventoRecorrente(linha: Event): {
  inicio: Date;
  fim: Date;
  fuso: string;
  regra: string | null;
  datasExcluidas: Date[];
} {
  return {
    inicio: linha.startsAt,
    fim: linha.endsAt,
    fuso: linha.timeZone,
    regra: linha.recurrenceRule,
    datasExcluidas: linha.excludedDates,
  };
}

/**
 * Valida a regra antes de gravá-la.
 *
 * `lerRrule` recusa o que o Norbit não implementa em vez de ignorar (ver
 * `docs/08-recorrencia.md`), e a recusa precisa chegar como 400 na requisição
 * que a causou. Sem isto a regra entraria no banco e toda consulta daquela
 * agenda passaria a quebrar — longe daqui, e para todos os membros.
 */
function regraValidada(
  regra: string | null | undefined,
): { ate?: Date } | null {
  if (!regra) {
    return null;
  }

  try {
    return lerRrule(regra);
  } catch (erro) {
    throw new BadRequestException(
      erro instanceof Error ? erro.message : 'Regra de recorrência inválida.',
    );
  }
}

function exigirSerie(evento: Event): void {
  if (evento.recurrenceRule === null) {
    throw new BadRequestException(
      'Este evento não é uma série: não há ocorrência para destacar ou excluir.',
    );
  }
}

/** Os campos de conteúdo, sem o que identifica a linha dentro da série. */
function semIdentidade(evento: Event): {
  calendarId: string;
  title: string;
  description: string | null;
  location: string | null;
  color: string | null;
  isAllDay: boolean;
  timeZone: string;
  status: Event['status'];
  visibility: Event['visibility'];
} {
  return {
    calendarId: evento.calendarId,
    title: evento.title,
    description: evento.description,
    location: evento.location,
    color: evento.color,
    isAllDay: evento.isAllDay,
    timeZone: evento.timeZone,
    status: evento.status,
    visibility: evento.visibility,
  };
}

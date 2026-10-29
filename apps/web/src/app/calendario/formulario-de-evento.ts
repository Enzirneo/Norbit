/**
 * O formulário de evento: criar, alterar e excluir.
 *
 * Nenhuma conta de tempo aqui. Texto de parede vira instante em
 * `deCamposParaInstante`, e a regra de repetição em `montarRrule` — as duas em
 * `libs/domain`, testadas sem navegador, porque é onde moram os defeitos de
 * "marquei 9h e salvou 6h" e "salvei o título e perdi o fim da série".
 *
 * O que **é** decisão desta camada: o que acontece ao salvar uma ocorrência de
 * uma série, que são três chamadas diferentes dependendo do escopo escolhido.
 */
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import {
  criarEventoSchema,
  type AgendaVisivel,
  type CriarEvento,
  type EventoVisivel,
} from '@norbit/contracts';
import {
  deCamposParaInstante,
  deInstanteParaCampos,
  lerRepeticao,
  montarRrule,
  podeNaAgenda,
  podeNoItem,
  type DiaDaSemana,
  type Repeticao,
} from '@norbit/domain';
import { Observable, switchMap } from 'rxjs';
import {
  errosDaApi,
  errosDoZod,
  type ErrosPorCampo,
} from '../auth/erros-de-formulario';
import { AuthService } from '../auth/auth.service';
import { Botao } from '../ui/botao';
import { Campo } from '../ui/campo';
import { CalendarioService } from './calendario.service';

export type AlvoDoFormulario =
  | {
      readonly modo: 'criar';
      /** O dia clicado na grade, em `AAAA-MM-DD`. */
      readonly dia: string;
      /**
       * A hora clicada, em `HH:MM`, quando vem da grade de horas.
       *
       * Ausente na visão de mês, onde o clique é num dia e não num horário: ali
       * vale o padrão de 09:00.
       */
      readonly hora?: string;
    }
  | {
      readonly modo: 'editar';
      readonly eventoId: string;
      /** A identidade da instância clicada, dentro da série. Ver docs/08. */
      readonly inicioOriginal: string;
      readonly ehRecorrente: boolean;
    };

/** Aplicar a alteração a uma ocorrência ou à série inteira. */
type Escopo = 'este' | 'todos';

export type TipoDeRepeticao = Repeticao['tipo'];

const DIAS: readonly { valor: DiaDaSemana; rotulo: string }[] = [
  { valor: 'MO', rotulo: 'Seg' },
  { valor: 'TU', rotulo: 'Ter' },
  { valor: 'WE', rotulo: 'Qua' },
  { valor: 'TH', rotulo: 'Qui' },
  { valor: 'FR', rotulo: 'Sex' },
  { valor: 'SA', rotulo: 'Sáb' },
  { valor: 'SU', rotulo: 'Dom' },
];

@Component({
  selector: 'nb-formulario-de-evento',
  imports: [ReactiveFormsModule, Campo, Botao],
  templateUrl: './formulario-de-evento.html',
  styleUrl: './formulario-de-evento.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormularioDeEvento {
  readonly alvo = input.required<AlvoDoFormulario>();
  readonly agendas = input.required<readonly AgendaVisivel[]>();
  /** O fuso de quem está vendo — o palpite para um evento novo. */
  readonly fuso = input.required<string>();

  readonly salvo = output<void>();
  readonly cancelado = output<void>();

  private readonly api = inject(CalendarioService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  protected readonly dias = DIAS;
  /**
   * Os campos só aparecem quando há o que mostrar.
   *
   * Ao editar, o formulário é preenchido **quando a resposta da API chega**, e
   * `reset()` sobrescreve tudo. Com os campos visíveis antes disso, quem
   * começasse a digitar — ou a escolher o escopo da série — perdia a escolha em
   * silêncio no momento em que o evento carregava.
   *
   * O defeito apareceu no e2e como "editar só esta renomeou a série inteira":
   * o rádio voltava para "todos" entre o clique e o salvamento.
   */
  protected readonly pronto = signal(false);

  protected readonly erros = signal<ErrosPorCampo>({});
  protected readonly enviando = signal(false);
  protected readonly confirmandoExclusao = signal(false);

  /** A regra original, quando o seletor não sabe expressá-la. */
  protected readonly regraPersonalizada = signal<string | null>(null);

  private readonly evento = signal<EventoVisivel | null>(null);

  protected readonly formulario = this.fb.nonNullable.group({
    title: '',
    calendarId: '',
    isAllDay: false,
    dataInicio: '',
    horaInicio: '09:00',
    dataFim: '',
    horaFim: '10:00',
    location: '',
    description: '',
    repeticao: 'nao-repete' as TipoDeRepeticao,
    // `control()` explícito, e não `[]`: o `FormBuilder` trata um array como o
    // atalho `[valor, validadores]`, então `diasDaSemana: []` vira um controle
    // de valor indefinido e o tipo colapsa para `DiaDaSemana` em vez de
    // `DiaDaSemana[]`. O erro aparece longe daqui, na primeira chamada de
    // `.filter`.
    diasDaSemana: this.fb.nonNullable.control<DiaDaSemana[]>([]),
    escopo: 'todos' as Escopo,
  });

  /** Só as agendas em que a pessoa pode criar — o seletor não oferece o resto. */
  protected readonly agendasPermitidas = computed(() =>
    this.agendas().filter((a) => podeNaAgenda(a.papel, 'criar-evento')),
  );

  protected readonly editando = computed(() => this.alvo().modo === 'editar');

  protected readonly precisaEscolherEscopo = computed(() => {
    const alvo = this.alvo();
    return alvo.modo === 'editar' && alvo.ehRecorrente;
  });

  /** Quem não pode alterar o evento não vê os botões de salvar e excluir. */
  protected readonly somenteLeitura = signal(false);

  /**
   * `true` quando a alteração vale só para a ocorrência aberta.
   *
   * Nesse caso a repetição fica indisponível: ela é da série, e mexer nela a
   * partir de uma exceção não tem significado.
   */
  protected readonly escopoEhSomenteEste = signal(false);

  constructor() {
    // O efeito observa **só** o alvo. `untracked` é o que impede que a chegada
    // da lista de agendas — que é assíncrona — reinicie o formulário e apague o
    // que a pessoa já digitou.
    // O seletor de repetição depende do escopo, e o escopo é um controle de
    // formulário: `valueChanges` é a ponte entre ele e um sinal que o template
    // consegue ler.
    this.formulario.controls.escopo.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((escopo) => this.aplicarEscopo(escopo === 'este'));

    effect(() => {
      const alvo = this.alvo();

      untracked(() => {
        if (alvo.modo === 'criar') {
          this.prepararCriacao(alvo.dia, alvo.hora);
        } else {
          this.carregar(alvo.eventoId);
        }
      });
    });
  }

  /**
   * Reflete o escopo no formulário.
   *
   * O controle é desabilitado por código, e não por `[disabled]` no template: o
   * Angular avisa contra isso em formulário reativo justamente porque a
   * diretiva e o atributo disputam a mesma propriedade, e quem ganha depende da
   * ordem da detecção de mudanças.
   *
   * `emitEvent: false` para não reentrar no próprio `valueChanges`.
   */
  private aplicarEscopo(somenteEste: boolean): void {
    this.escopoEhSomenteEste.set(somenteEste);

    const repeticao = this.formulario.controls.repeticao;
    if (somenteEste) {
      repeticao.disable({ emitEvent: false });
    } else {
      repeticao.enable({ emitEvent: false });
    }
  }

  protected alternarDia(dia: DiaDaSemana): void {
    const atuais = this.formulario.controls.diasDaSemana.value;
    const proximos = atuais.includes(dia)
      ? atuais.filter((d) => d !== dia)
      : [...atuais, dia];

    this.formulario.controls.diasDaSemana.setValue(proximos);
  }

  protected temDia(dia: DiaDaSemana): boolean {
    return this.formulario.controls.diasDaSemana.value.includes(dia);
  }

  protected salvar(): void {
    const alvo = this.alvo();

    if (alvo.modo === 'criar') {
      this.enviar((dados) =>
        this.api.criarEvento(this.formulario.controls.calendarId.value, dados),
      );
      return;
    }

    // Série + "só este": a ocorrência vira uma linha filha antes de receber a
    // alteração. São duas chamadas porque são duas coisas — destacar é criar a
    // exceção, e a edição é da exceção. Ver docs/09.
    if (alvo.ehRecorrente && this.formulario.controls.escopo.value === 'este') {
      this.enviar((dados) =>
        this.api.destacarOcorrencia(alvo.eventoId, alvo.inicioOriginal).pipe(
          switchMap((filha) =>
            // **Sem a regra.** A filha é uma ocorrência só, por definição — e
            // o seletor de repetição continua mostrando a regra da série. Sem
            // este `null`, a exceção nascia com a regra da mãe e virava uma
            // segunda série paralela: dez ocorrências no lugar de uma.
            this.api.atualizarEvento(filha.id, {
              ...dados,
              recurrenceRule: null,
            }),
          ),
        ),
      );
      return;
    }

    this.enviar((dados) => this.api.atualizarEvento(alvo.eventoId, dados));
  }

  protected excluir(): void {
    const alvo = this.alvo();
    if (alvo.modo !== 'editar') {
      return;
    }

    this.enviando.set(true);

    const chamada =
      alvo.ehRecorrente && this.formulario.controls.escopo.value === 'este'
        ? this.api.excluirOcorrencia(alvo.eventoId, alvo.inicioOriginal)
        : this.api.removerEvento(alvo.eventoId);

    chamada.subscribe({
      next: () => this.salvo.emit(),
      error: (erro: unknown) => this.falhou(erro),
    });
  }

  // ─── privados ──────────────────────────────────────────────────────────────

  private prepararCriacao(dia: string, hora?: string): void {
    const padrao = this.agendasPermitidas().find((a) => a.isDefault);

    // Uma hora de duração a partir do horário clicado. É o palpite que quase
    // sempre acerta, e ajustar é um campo ao lado.
    const inicio = hora ?? '09:00';
    const fim = umaHoraDepois(inicio);

    this.pronto.set(true);
    this.evento.set(null);
    this.regraPersonalizada.set(null);
    this.somenteLeitura.set(false);
    this.formulario.reset({
      title: '',
      calendarId: padrao?.id ?? this.agendasPermitidas()[0]?.id ?? '',
      isAllDay: false,
      dataInicio: dia,
      horaInicio: inicio,
      dataFim: dia,
      horaFim: fim,
      location: '',
      description: '',
      repeticao: 'nao-repete',
      diasDaSemana: [],
      escopo: 'todos',
    });
    this.aplicarEscopo(false);
  }

  private carregar(id: string): void {
    this.pronto.set(false);

    this.api.evento(id).subscribe({
      next: (evento) => {
        this.preencher(evento);
        this.pronto.set(true);
      },
      error: (erro: unknown) => this.erros.set(errosDaApi(erro)),
    });
  }

  private preencher(evento: EventoVisivel): void {
    const inicio = deInstanteParaCampos(
      new Date(evento.startsAt),
      evento.timeZone,
    );
    // O fim gravado de um dia inteiro é a meia-noite **seguinte** (exclusivo),
    // e mostrá-la como "fim" faria o formulário dizer um dia a mais. Ver
    // docs/09.
    const fimReal = evento.isAllDay
      ? new Date(new Date(evento.endsAt).getTime() - 1)
      : new Date(evento.endsAt);
    const fim = deInstanteParaCampos(fimReal, evento.timeZone);

    const repeticao = lerRepeticao(evento.recurrenceRule);

    this.evento.set(evento);
    this.regraPersonalizada.set(
      repeticao.tipo === 'personalizada' ? repeticao.regra : null,
    );
    this.somenteLeitura.set(!this.podeAlterar(evento));

    this.formulario.reset({
      title: evento.title,
      calendarId: evento.calendarId,
      isAllDay: evento.isAllDay,
      dataInicio: inicio.data,
      horaInicio: inicio.hora ?? '09:00',
      dataFim: fim.data,
      horaFim: fim.hora ?? '10:00',
      location: evento.location ?? '',
      description: evento.description ?? '',
      repeticao: repeticao.tipo,
      diasDaSemana: repeticao.tipo === 'semanal' ? [...repeticao.dias] : [],
      escopo: 'todos',
    });
    this.aplicarEscopo(false);
  }

  /**
   * A mesma matriz do servidor, aplicada antes de mostrar o botão.
   *
   * Não é segurança — essa é do servidor, em `AcessoService`. É para não
   * oferecer uma ação que vai voltar 403.
   */
  private podeAlterar(evento: EventoVisivel): boolean {
    const agenda = this.agendas().find((a) => a.id === evento.calendarId);
    if (!agenda) {
      return false;
    }

    return podeNoItem({
      papel: agenda.papel,
      acao: 'editar-evento',
      // Quem está logado, e não o dono da agenda: é a autoria que o
      // CONTRIBUTOR precisa ter.
      ehAutor: evento.createdById === this.auth.usuario()?.id,
    });
  }

  private enviar(
    chamada: (dados: CriarEvento) => Observable<EventoVisivel>,
  ): void {
    const dados = this.montar();
    if (dados === null) {
      return;
    }

    this.enviando.set(true);

    chamada(dados).subscribe({
      next: () => this.salvo.emit(),
      error: (erro: unknown) => this.falhou(erro),
    });
  }

  /**
   * Monta o corpo e valida com o **mesmo** schema que a API aplica.
   *
   * A conversão de texto para instante pode lançar (data que não existe no
   * calendário), e isso é erro de campo, não de rede: vira mensagem no
   * formulário em vez de subir.
   */
  private montar(): CriarEvento | null {
    const valor = this.formulario.getRawValue();
    const fuso = this.evento()?.timeZone ?? this.fuso();

    try {
      const bruto = {
        title: valor.title,
        startsAt: this.instante(valor.dataInicio, valor.horaInicio, fuso),
        endsAt: this.instante(valor.dataFim, valor.horaFim, fuso),
        isAllDay: valor.isAllDay,
        timeZone: fuso,
        location: valor.location === '' ? undefined : valor.location,
        description: valor.description === '' ? undefined : valor.description,
        recurrenceRule: this.regra(valor.repeticao, valor.diasDaSemana),
      };

      const validado = criarEventoSchema.safeParse(bruto);
      if (!validado.success) {
        this.erros.set(errosDoZod(validado.error));
        return null;
      }

      this.erros.set({});
      return validado.data;
    } catch (erro) {
      this.erros.set({
        formulario: erro instanceof Error ? erro.message : 'Datas inválidas.',
      });
      return null;
    }
  }

  private instante(data: string, hora: string, fuso: string): string {
    const campos = this.formulario.controls.isAllDay.value
      ? { data }
      : { data, hora };

    return deCamposParaInstante(campos, fuso).toISOString();
  }

  /**
   * A regra para o corpo da requisição.
   *
   * Devolve `null`, e não `undefined`, quando não há repetição: num PATCH,
   * `undefined` significa "não mexa" e deixaria a série intacta — tirar a
   * repetição de um evento não funcionaria, sem erro nenhum.
   */
  private regra(
    tipo: TipoDeRepeticao,
    dias: readonly DiaDaSemana[],
  ): string | null {
    return montarRrule(this.escolhaDe(tipo, dias));
  }

  /**
   * Uma regra que o seletor não expressa atravessa **intacta**.
   *
   * É o contrato de `lerRepeticao`/`montarRrule`, e o que impede que salvar o
   * título apague o fim da série.
   */
  private escolhaDe(
    tipo: TipoDeRepeticao,
    dias: readonly DiaDaSemana[],
  ): Repeticao {
    const personalizada = this.regraPersonalizada();

    switch (tipo) {
      case 'personalizada':
        return personalizada === null
          ? { tipo: 'nao-repete' }
          : { tipo: 'personalizada', regra: personalizada };
      case 'semanal':
        return { tipo: 'semanal', dias };
      case 'diaria':
      case 'mensal':
      case 'anual':
      case 'nao-repete':
        return { tipo };
    }
  }

  private falhou(erro: unknown): void {
    this.enviando.set(false);
    this.confirmandoExclusao.set(false);
    this.erros.set(errosDaApi(erro));
  }
}

/**
 * Uma hora depois, no mesmo dia.
 *
 * Satura em 23:59 em vez de virar o dia: um evento das 23:30 à meia-noite teria
 * de mexer na data de fim também, e um palpite que muda dois campos é pior que
 * um palpite curto.
 */
function umaHoraDepois(hora: string): string {
  const [h, m] = hora.split(':').map(Number);
  const total = (h ?? 9) * 60 + (m ?? 0) + 60;

  if (total >= 24 * 60) {
    return '23:59';
  }

  const dois = (v: number): string => String(v).padStart(2, '0');
  return `${dois(Math.floor(total / 60))}:${dois(total % 60)}`;
}

/**
 * A tela do calendário.
 *
 * Primeira tela com dado de verdade. Ela compõe três coisas: o cabeçalho de
 * navegação, a barra lateral das agendas e a visão de mês — e carrega o que a
 * API tem para o intervalo visível.
 *
 * O carregamento é explícito, chamado pelas ações de navegação, e não um
 * `effect` observando o mês. Com `effect` a ordem entre "o sinal mudou" e "a
 * requisição saiu" fica implícita, e duas navegações rápidas podem resolver fora
 * de ordem sem que o código diga nada sobre isso.
 */
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import type { AgendaVisivel, OcorrenciaVisivel } from '@norbit/contracts';
import {
  avancarPeriodo,
  type Periodo,
  diasDaSemanaDe,
  gradeDeMes,
  intervaloDaGrade,
  intervaloDosDias,
  paraHoraLocal,
  type DataCivil,
} from '@norbit/domain';
import { AuthService } from '../../auth/auth.service';
import { Botao } from '../../ui/botao';
import { Dialogo } from '../../ui/dialogo';
import { Marca } from '../../ui/marca';
import { CalendarioService } from '../calendario.service';
import {
  FormularioDeEvento,
  type AlvoDoFormulario,
} from '../formulario-de-evento';
import { VisaoDeHoras } from '../visao-de-horas';
import { VisaoDeMes } from '../visao-de-mes';

/**
 * Domingo, como o padrão de `UserSettings.weekStartsOn` no banco.
 *
 * A preferência existe no modelo mas a API ainda não a expõe — `GET /auth/eu`
 * devolve o usuário, não as preferências. Quando expuser, isto vira uma leitura
 * e nada mais muda: `gradeDeMes` já recebe o valor como parâmetro.
 */
const INICIO_DA_SEMANA = 0;

/**
 * As visões que o produto tem hoje.
 *
 * É o `Periodo` de `libs/domain`: a lista mora onde a navegação a usa, e não em
 * duas cópias que podem discordar. O `CalendarView` do banco também tem
 * `AGENDA`, que ainda não existe na tela.
 */
export type Visao = Periodo;

@Component({
  selector: 'nb-calendario',
  imports: [
    Botao,
    Dialogo,
    FormularioDeEvento,
    Marca,
    VisaoDeHoras,
    VisaoDeMes,
  ],
  templateUrl: './calendario.html',
  styleUrl: './calendario.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Calendario {
  private readonly api = inject(CalendarioService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly usuario = this.auth.usuario;

  /**
   * O fuso de quem está vendo.
   *
   * O do perfil manda; o do navegador é a reserva para o instante entre a
   * primeira pintura e a chegada do perfil. Sem a reserva, a grade nasceria em
   * UTC e os dias deslizariam ao carregar.
   */
  protected readonly fuso = computed(
    () =>
      this.usuario()?.timeZone ??
      Intl.DateTimeFormat().resolvedOptions().timeZone,
  );

  protected readonly hoje = computed(() => {
    const { ano, mes, dia } = paraHoraLocal(new Date(), this.fuso());
    return { ano, mes, dia };
  });

  protected readonly visao = signal<Visao>('MONTH');

  protected readonly visoes: readonly { valor: Visao; rotulo: string }[] = [
    { valor: 'MONTH', rotulo: 'Mês' },
    { valor: 'WEEK', rotulo: 'Semana' },
    { valor: 'DAY', rotulo: 'Dia' },
  ];

  /**
   * A data de referência, comum às três visões.
   *
   * Uma só, e não uma por visão: trocar de visão mantém a pessoa onde ela
   * estava, que é o comportamento esperado — e dois estados concordando é a
   * forma mais fácil de eles discordarem.
   *
   * Nasce em **hoje no fuso de quem vê**, e não no do navegador: nos últimos e
   * primeiros dias do mês os dois discordam, e a tela abriria no mês errado
   * para quem está viajando.
   */
  private readonly referencia = signal<DataCivil>(this.hoje());

  protected readonly grade = computed(() =>
    gradeDeMes({
      ano: this.referencia().ano,
      mes: this.referencia().mes,
      inicioDaSemana: INICIO_DA_SEMANA,
    }),
  );

  /** Os dias das visões de hora: sete na semana, um no dia. */
  protected readonly diasVisiveis = computed<readonly DataCivil[]>(() =>
    this.visao() === 'WEEK'
      ? diasDaSemanaDe(this.referencia(), INICIO_DA_SEMANA)
      : [this.referencia()],
  );

  protected readonly titulo = computed(() =>
    tituloDe({
      visao: this.visao(),
      referencia: this.referencia(),
      dias: this.diasVisiveis(),
    }),
  );

  protected readonly agendas = signal<readonly AgendaVisivel[]>([]);
  protected readonly ocultas = signal<ReadonlySet<string>>(new Set());
  protected readonly carregando = signal(false);
  protected readonly erro = signal<string | null>(null);

  private readonly todas = signal<readonly OcorrenciaVisivel[]>([]);

  /**
   * As ocorrências que a tela mostra.
   *
   * Esconder uma agenda filtra o que já está na memória em vez de refazer a
   * consulta: a API devolveu tudo o que a pessoa vê, e ir ao servidor para
   * esconder algo que já chegou seria uma espera sem informação nova.
   */
  protected readonly visiveis = computed(() =>
    this.todas().filter((o) => !this.ocultas().has(o.calendarId)),
  );

  protected readonly vazio = computed(
    () => !this.carregando() && this.visiveis().length === 0,
  );

  /**
   * O que o diálogo está editando, ou `null` com ele fechado.
   *
   * Um sinal só para as duas coisas: o diálogo abre porque existe alvo, e não
   * por um booleano separado que pode discordar dele.
   */
  protected readonly alvo = signal<AlvoDoFormulario | null>(null);

  protected readonly tituloDoDialogo = computed(() =>
    this.alvo()?.modo === 'editar' ? 'Editar evento' : 'Novo evento',
  );

  constructor() {
    this.api.agendas().subscribe({
      next: (agendas) => this.agendas.set(agendas),
      error: () => this.erro.set('Não foi possível carregar suas agendas.'),
    });

    this.carregar();
  }

  protected anterior(): void {
    this.irPara(-1);
  }

  protected seguinte(): void {
    this.irPara(1);
  }

  protected irParaHoje(): void {
    this.referencia.set(this.hoje());
    this.carregar();
  }

  /**
   * Troca a visão sem mover a data.
   *
   * Recarrega porque o intervalo consultado muda: a semana pede sete dias, o mês
   * pede quarenta e dois.
   */
  protected mudarVisao(visao: Visao): void {
    this.visao.set(visao);
    this.carregar();
  }

  protected alternarAgenda(id: string): void {
    const ocultas = new Set(this.ocultas());
    if (!ocultas.delete(id)) {
      ocultas.add(id);
    }
    this.ocultas.set(ocultas);
  }

  protected estaOculta(id: string): boolean {
    return this.ocultas().has(id);
  }

  protected criarEm(dia: string): void {
    this.alvo.set({ modo: 'criar', dia });
  }

  /** Clique na grade de horas: o dia **e** a hora clicada. */
  protected criarEmHora(quando: { dia: string; hora: string }): void {
    this.alvo.set({ modo: 'criar', dia: quando.dia, hora: quando.hora });
  }

  protected editar(ocorrencia: OcorrenciaVisivel): void {
    this.alvo.set({
      modo: 'editar',
      eventoId: ocorrencia.id,
      // A identidade da instância, não a da linha: é por ela que "só este"
      // sabe qual ocorrência substituir. Ver docs/08.
      inicioOriginal: ocorrencia.inicioOriginal,
      ehRecorrente: ocorrencia.ehRecorrente,
    });
  }

  protected fecharDialogo(): void {
    this.alvo.set(null);
  }

  protected aoSalvar(): void {
    this.alvo.set(null);
    // Recarrega em vez de remendar a lista na memória: uma alteração pode criar
    // uma linha filha, mudar a regra da série ou mover o evento para fora do
    // mês, e reproduzir isso no cliente seria uma segunda implementação da
    // expansão.
    this.carregar();
  }

  protected sair(): void {
    this.auth.sair().subscribe(() => {
      void this.router.navigateByUrl('/entrar');
    });
  }

  /**
   * Um passo para frente ou para trás, no tamanho da visão.
   *
   * A aritmética é de `avancarPeriodo`, em `libs/domain` — inclusive a decisão
   * sobre o dia 31, que não existe em todo mês.
   */
  private irPara(passo: number): void {
    this.referencia.set(avancarPeriodo(this.referencia(), this.visao(), passo));
    this.carregar();
  }

  /** O intervalo que a visão atual precisa consultar. */
  private intervalo(): { de: Date; ate: Date } {
    return this.visao() === 'MONTH'
      ? intervaloDaGrade(this.grade(), this.fuso())
      : intervaloDosDias(this.diasVisiveis(), this.fuso());
  }

  private carregar(): void {
    this.carregando.set(true);
    this.erro.set(null);

    this.api.ocorrencias(this.intervalo()).subscribe({
      next: (ocorrencias) => {
        this.todas.set(ocorrencias);
        this.carregando.set(false);
      },
      error: () => {
        this.erro.set('Não foi possível carregar os eventos.');
        this.carregando.set(false);
      },
    });
  }
}

/**
 * O título da barra, no formato de cada visão.
 *
 * Fora da classe para não virar três `computed` que só diferem no formato.
 */
function tituloDe(entrada: {
  readonly visao: Visao;
  readonly referencia: DataCivil;
  readonly dias: readonly DataCivil[];
}): string {
  if (entrada.visao === 'MONTH') {
    const { ano, mes } = entrada.referencia;
    return `${comInicialMaiuscula(nomeDoMes(ano, mes))} de ${ano}`;
  }

  const primeiro = entrada.dias[0];
  const ultimo = entrada.dias[entrada.dias.length - 1];

  if (!primeiro || !ultimo) {
    return '';
  }

  if (entrada.visao === 'DAY') {
    return comInicialMaiuscula(
      new Intl.DateTimeFormat('pt-BR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        timeZone: 'UTC',
      }).format(
        new Date(Date.UTC(primeiro.ano, primeiro.mes - 1, primeiro.dia)),
      ),
    );
  }

  // Semana: "14 – 20 de junho", com os dois meses quando ela os atravessa.
  const mesmoMes = primeiro.mes === ultimo.mes && primeiro.ano === ultimo.ano;
  const inicio = mesmoMes
    ? `${primeiro.dia}`
    : `${primeiro.dia} de ${nomeDoMes(primeiro.ano, primeiro.mes)}`;

  return `${inicio} – ${ultimo.dia} de ${nomeDoMes(ultimo.ano, ultimo.mes)}`;
}

function nomeDoMes(ano: number, mes: number): string {
  return new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(ano, mes - 1, 1)));
}

function comInicialMaiuscula(texto: string): string {
  return `${texto[0]?.toUpperCase() ?? ''}${texto.slice(1)}`;
}

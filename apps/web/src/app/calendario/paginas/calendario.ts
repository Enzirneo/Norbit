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
import { gradeDeMes, intervaloDaGrade, paraHoraLocal } from '@norbit/domain';
import { AuthService } from '../../auth/auth.service';
import { Botao } from '../../ui/botao';
import { Dialogo } from '../../ui/dialogo';
import { Marca } from '../../ui/marca';
import { CalendarioService } from '../calendario.service';
import {
  FormularioDeEvento,
  type AlvoDoFormulario,
} from '../formulario-de-evento';
import { VisaoDeMes } from '../visao-de-mes';

/**
 * Domingo, como o padrão de `UserSettings.weekStartsOn` no banco.
 *
 * A preferência existe no modelo mas a API ainda não a expõe — `GET /auth/eu`
 * devolve o usuário, não as preferências. Quando expuser, isto vira uma leitura
 * e nada mais muda: `gradeDeMes` já recebe o valor como parâmetro.
 */
const INICIO_DA_SEMANA = 0;

@Component({
  selector: 'nb-calendario',
  imports: [Botao, Dialogo, FormularioDeEvento, Marca, VisaoDeMes],
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

  /**
   * O mês aberto.
   *
   * Nasce no mês de **hoje no fuso de quem vê**, e não no fuso do navegador: nos
   * últimos e primeiros dias do mês os dois discordam, e a tela abriria no mês
   * errado para quem está viajando.
   */
  private readonly mesVisivel = signal({
    ano: this.hoje().ano,
    mes: this.hoje().mes,
  });

  protected readonly grade = computed(() =>
    gradeDeMes({ ...this.mesVisivel(), inicioDaSemana: INICIO_DA_SEMANA }),
  );

  protected readonly titulo = computed(() => {
    const { ano, mes } = this.mesVisivel();
    const nome = new Intl.DateTimeFormat('pt-BR', {
      month: 'long',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(ano, mes - 1, 1)));

    return `${nome[0]?.toUpperCase()}${nome.slice(1)} de ${ano}`;
  });

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

  protected mesAnterior(): void {
    this.irPara(-1);
  }

  protected mesSeguinte(): void {
    this.irPara(1);
  }

  protected irParaHoje(): void {
    this.mesVisivel.set({ ano: this.hoje().ano, mes: this.hoje().mes });
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

  private irPara(passo: number): void {
    const { ano, mes } = this.mesVisivel();
    const zeroABase = ano * 12 + (mes - 1) + passo;

    this.mesVisivel.set({
      ano: Math.floor(zeroABase / 12),
      mes: (zeroABase % 12) + 1,
    });
    this.carregar();
  }

  private carregar(): void {
    this.carregando.set(true);
    this.erro.set(null);

    this.api
      .ocorrencias(intervaloDaGrade(this.grade(), this.fuso()))
      .subscribe({
        next: (ocorrencias) => {
          this.todas.set(ocorrencias);
          this.carregando.set(false);
        },
        error: () => {
          this.erro.set('Não foi possível carregar os eventos deste mês.');
          this.carregando.set(false);
        },
      });
  }
}

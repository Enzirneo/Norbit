/**
 * O catálogo vivo do design system: cada componente em cada estado, sob o tema
 * que se escolher aqui. Só existe em desenvolvimento (ver `rotas-do-catalogo.ts`).
 *
 * O tema escolhido é **só de visualização**: vai para a página, não para a conta
 * nem para o cache. Ao sair, a aparência da conta volta.
 *
 * O e2e visita esta página em cada tema pronto, roda axe e confere o contraste:
 * é o que cumpre a auditoria de acessibilidade do roadmap.
 */
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { TEMA_PADRAO, type Tema } from '@norbit/contracts';
import {
  ACENTOS,
  TEMAS_PRONTOS,
  derivar,
  type NomeDeTemaPronto,
} from '@norbit/design-tokens';
import { aparenciaDe, aplicarAparencia } from '../preferencias/aparencia';
import { PreferenciasService } from '../preferencias/preferencias.service';
import { Alternador, type OpcaoDoAlternador } from '../ui/alternador';
import { Avatar } from '../ui/avatar';
import { Aviso } from '../ui/aviso';
import { Botao } from '../ui/botao';
import { CabecalhoDePagina } from '../ui/cabecalho-de-pagina';
import { Campo } from '../ui/campo';
import { CartaoDeSecao } from '../ui/cartao-de-secao';
import { EstadoVazio } from '../ui/estado-vazio';
import { Etiqueta } from '../ui/etiqueta';
import { Lua } from '../ui/lua';
import { ToastService } from '../ui/toast.service';

const VISOES: readonly OpcaoDoAlternador<string>[] = [
  { valor: 'MONTH', rotulo: 'Mês' },
  { valor: 'WEEK', rotulo: 'Semana' },
  { valor: 'DAY', rotulo: 'Dia' },
];

@Component({
  selector: 'nb-catalogo',
  imports: [
    Alternador,
    Avatar,
    Aviso,
    Botao,
    CabecalhoDePagina,
    Campo,
    CartaoDeSecao,
    EstadoVazio,
    Etiqueta,
    Lua,
  ],
  templateUrl: './catalogo.html',
  styleUrl: './catalogo.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Catalogo {
  private readonly preferencias = inject(PreferenciasService);
  private readonly toasts = inject(ToastService);

  protected readonly temasProntos = Object.keys(TEMAS_PRONTOS);
  protected readonly acentos = Object.values(ACENTOS);
  protected readonly aparenciasDeBotao = [
    'solido',
    'contorno',
    'texto',
    'perigo',
  ] as const;
  protected readonly visoes = VISOES;
  protected readonly fases = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875];

  protected readonly tema = signal<Tema>(TEMA_PADRAO);
  protected readonly visao = signal('WEEK');

  protected readonly avisosDoMotor = computed(
    () => derivar(this.tema().sementes).avisos,
  );

  constructor() {
    effect(() =>
      aplicarAparencia(
        aparenciaDe({ ...this.preferencias.preferencias(), tema: this.tema() }),
      ),
    );

    inject(DestroyRef).onDestroy(() =>
      aplicarAparencia(aparenciaDe(this.preferencias.preferencias())),
    );
  }

  protected escolherTema(nome: string): void {
    const pronto = TEMAS_PRONTOS[nome as NomeDeTemaPronto];
    this.tema.update((t) => ({
      ...t,
      base: nome as NomeDeTemaPronto,
      sementes: { ...pronto },
    }));
  }

  protected mudarSemente(campo: 'fundo' | 'destaque', valor: string): void {
    this.tema.update((t) => ({
      ...t,
      base: null,
      sementes: { ...t.sementes, [campo]: valor },
    }));
  }

  protected alternarContrasteAlto(alto: boolean): void {
    this.tema.update((t) => ({
      ...t,
      sementes: { ...t.sementes, contraste: alto ? 'alto' : 'normal' },
    }));
  }

  protected mudarCantos(valor: string): void {
    this.tema.update((t) => ({
      ...t,
      forma: { ...t.forma, cantos: Number(valor) },
    }));
  }

  protected alternarEstrelas(ligadas: boolean): void {
    this.tema.update((t) => ({
      ...t,
      forma: { ...t.forma, estrelas: ligadas },
    }));
  }

  protected mostrarToast(tipo: 'sucesso' | 'perigo' | 'info'): void {
    this.toasts.mostrar(`Aviso de ${tipo}`, { tipo });
  }
}

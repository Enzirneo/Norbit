/**
 * As preferências da conta: acesso à API e **aplicação** no documento.
 *
 * Um serviço só para as duas coisas porque elas são inseparáveis: preferência
 * que chega e não é aplicada é preferência que não existe, e aplicar em dois
 * lugares abriria espaço para a tela e o servidor discordarem.
 */
import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import type {
  AtualizarPreferencias,
  PreferenciasVisiveis,
} from '@norbit/contracts';
import { tap, type Observable } from 'rxjs';
import { aparenciaDe, aplicarAparencia, guardarAparencia } from './aparencia';

/**
 * Os padrões, para a tela ter o que desenhar antes de a resposta chegar.
 *
 * Iguais aos do banco de propósito: se discordassem, a interface piscaria de um
 * estado para o outro no carregamento.
 */
const PADRAO: PreferenciasVisiveis = {
  accentColor: '#6d7cff',
  density: 1,
  reducedMotion: false,
  defaultView: 'MONTH',
  weekStartsOn: 0,
  use24Hour: true,
};

@Injectable({ providedIn: 'root' })
export class PreferenciasService {
  private readonly http = inject(HttpClient);

  private readonly atuais = signal<PreferenciasVisiveis>(PADRAO);

  readonly preferencias = this.atuais.asReadonly();

  /** A visão com que o calendário abre. `AGENDA` ainda não existe na tela. */
  readonly visaoInicial = computed(() => {
    const escolhida = this.atuais().defaultView;
    return escolhida === 'AGENDA' ? 'MONTH' : escolhida;
  });

  carregar(): Observable<PreferenciasVisiveis> {
    return this.http
      .get<PreferenciasVisiveis>('/api/preferencias')
      .pipe(tap((lidas) => this.adotar(lidas)));
  }

  atualizar(dados: AtualizarPreferencias): Observable<PreferenciasVisiveis> {
    return this.http
      .patch<PreferenciasVisiveis>('/api/preferencias', dados)
      .pipe(tap((lidas) => this.adotar(lidas)));
  }

  /**
   * Guarda, aplica e **lembra para a próxima abertura**.
   *
   * O cache é o que o script do `index.html` lê antes de o Angular existir —
   * sem ele, a aparência só vale depois do carregamento e a tela troca de cor
   * diante de quem olha.
   */
  private adotar(lidas: PreferenciasVisiveis): void {
    this.atuais.set(lidas);

    const aparencia = aparenciaDe(lidas);
    aplicarAparencia(aparencia);
    guardarAparencia(aparencia);
  }
}

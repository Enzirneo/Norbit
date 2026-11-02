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
import { derivarAcento } from '@norbit/design-tokens';
import { tap, type Observable } from 'rxjs';

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

/**
 * A unidade de espaçamento por densidade.
 *
 * A densidade multiplica a **unidade base**, que é o mecanismo que o
 * `primitives.ts` já descrevia: "nenhum componente conhece a densidade, todos
 * leem a variável". Como todo espaçamento do projeto é
 * `calc(var(--space-unit) * n)`, mudar a unidade muda a tela inteira de uma vez.
 *
 * Uma primeira versão escrevia um `--row-height` que **nada lia** — uma
 * variável inventada para o seletor de densidade parecer funcionar.
 */
const UNIDADES = ['3px', '4px', '5px'] as const;

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
   * Guarda e aplica.
   *
   * A aplicação escreve custom properties em `:root`, e não em nenhum
   * componente: é o que a camada semântica dos tokens existe para permitir —
   * trocar o acento redefine `--accent` e nenhum componente é tocado.
   *
   * `document.documentElement` e não um estilo de componente: o compilador do
   * Angular 22 renomeia as custom properties declaradas em estilo de componente
   * (ver `visao-de-mes.ts`), e o que precisa ser escrito aqui são exatamente os
   * nomes que o `tokens.generated.css` declarou globalmente.
   */
  private adotar(lidas: PreferenciasVisiveis): void {
    this.atuais.set(lidas);

    const raiz = document.documentElement;
    const derivado = derivarAcento(lidas.accentColor);

    raiz.style.setProperty('--accent', derivado.accent);
    raiz.style.setProperty('--accent-hover', derivado.accentHover);
    raiz.style.setProperty('--accent-muted', derivado.accentMuted);
    raiz.style.setProperty('--text-on-accent', derivado.textOnAccent);
    // O anel de foco acompanha o acento: ele existe para ser notado, e um foco
    // de outra cor pareceria de outro produto.
    raiz.style.setProperty('--border-focus', derivado.accent);

    raiz.style.setProperty(
      '--space-unit',
      UNIDADES[lidas.density] ?? UNIDADES[1],
    );

    // Um atributo, e não uma variável: a redução de movimento desliga
    // transições, e o CSS precisa de um seletor para isso. Ele **soma** à
    // consulta de mídia do sistema, sem substituí-la: quem já pediu menos
    // movimento no sistema operacional continua sendo atendido.
    raiz.toggleAttribute('data-sem-movimento', lidas.reducedMotion);
  }
}

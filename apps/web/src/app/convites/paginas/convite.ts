/**
 * A tela que o link do convite abre.
 *
 * Quem chega aqui pode estar de três jeitos: sem conta, com conta mas sem
 * sessão, ou já logado. A previsão é pública — a pessoa precisa saber **de quê**
 * está sendo convidada antes de decidir criar conta —, então ela aparece nos
 * três. O que muda é o que se pode fazer: sem sessão, entrar ou criar a conta
 * e **voltar para cá**; com sessão, aceitar ou recusar.
 */
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { PrevisaoDeConvite } from '@norbit/contracts';
import { AuthService } from '../../auth/auth.service';
import { errosDaApi } from '../../auth/erros-de-formulario';
import { Moldura } from '../../auth/paginas/moldura';
import { Botao } from '../../ui/botao';
import { ConvitesService } from '../convites.service';
import { rotuloDoPapel } from '../papel';

@Component({
  selector: 'nb-convite',
  imports: [RouterLink, Moldura, Botao],
  templateUrl: './convite.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Convite {
  private readonly convites = inject(ConvitesService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** Vem do link do e-mail; sem ele não há o que mostrar. */
  private readonly token =
    inject(ActivatedRoute).snapshot.queryParamMap.get('token') ?? '';

  protected readonly usuario = this.auth.usuario;

  protected readonly previsao = signal<PrevisaoDeConvite | null>(null);
  protected readonly carregando = signal(true);
  protected readonly agindo = signal(false);
  protected readonly erro = signal<string | null>(null);
  protected readonly recusado = signal(false);

  protected readonly subtitulo = computed(() => {
    const previsao = this.previsao();
    return previsao ? `${previsao.convidadoPor} convidou você.` : undefined;
  });

  protected readonly papel = computed(() => {
    const previsao = this.previsao();
    return previsao ? rotuloDoPapel(previsao.papel) : '';
  });

  /** Para onde voltar depois de entrar: esta mesma tela, com o mesmo token. */
  private readonly voltarPara = `/convite?token=${encodeURIComponent(this.token)}`;

  constructor() {
    if (this.token === '') {
      this.carregando.set(false);
      this.erro.set('O link está incompleto. Use o link do convite.');
      return;
    }

    this.convites.previsao(this.token).subscribe({
      next: (previsao) => {
        this.previsao.set(previsao);
        this.carregando.set(false);
      },
      error: (erro: unknown) => {
        this.erro.set(mensagemDe(erro));
        this.carregando.set(false);
      },
    });
  }

  protected aceitar(): void {
    this.agindo.set(true);
    this.erro.set(null);

    this.convites.aceitar(this.token).subscribe({
      next: () => {
        void this.router.navigateByUrl('/');
      },
      error: (erro: unknown) => {
        this.agindo.set(false);
        this.erro.set(mensagemDe(erro));
      },
    });
  }

  protected recusar(): void {
    this.agindo.set(true);
    this.erro.set(null);

    this.convites.recusar(this.token).subscribe({
      next: () => {
        this.agindo.set(false);
        this.recusado.set(true);
      },
      error: (erro: unknown) => {
        this.agindo.set(false);
        this.erro.set(mensagemDe(erro));
      },
    });
  }

  protected entrar(): void {
    void this.router.navigate(['/entrar'], {
      queryParams: { voltarPara: this.voltarPara },
    });
  }

  protected criarConta(): void {
    void this.router.navigate(['/criar-conta'], {
      queryParams: { voltarPara: this.voltarPara },
    });
  }

  /**
   * Para quem abriu o link com a conta errada — o convite por e-mail só vale
   * para o endereço a que foi enviado.
   */
  protected trocarDeConta(): void {
    this.auth.sair().subscribe(() => this.entrar());
  }
}

/** A API explica o motivo (não existe, venceu, é de outra conta); basta mostrá-lo. */
function mensagemDe(erro: unknown): string {
  return errosDaApi(erro)['formulario'] ?? 'Não foi possível concluir.';
}

/**
 * O avatar: as iniciais da pessoa num círculo, na cor do destaque do tema.
 *
 * Iniciais, e não imagem, porque ainda não há onde guardar arquivos. É
 * decorativo (`aria-hidden`): o nome vem sempre escrito ao lado.
 */
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { corDeAvatar } from '@norbit/design-tokens';
import { iniciaisDe } from '../perfil/iniciais';

export type TamanhoDoAvatar = 'p' | 'm' | 'g';

@Component({
  selector: 'nb-avatar',
  template: `{{ iniciais() }}`,
  styleUrl: './avatar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-hidden': 'true',
    '[class]': '"avatar--" + tamanho()',
    '[class.avatar--cor]': 'colorido()',
    '[style.--avatar-fundo]': 'cores()?.fundo',
    '[style.--avatar-texto]': 'cores()?.texto',
  },
})
export class Avatar {
  readonly nome = input.required<string>();
  readonly tamanho = input<TamanhoDoAvatar>('m');
  /**
   * A cor de perfil da pessoa. Sem ela, o avatar usa o destaque do tema. Com ela,
   * o fundo é a cor (ajustada só se o texto não coubesse nela) e o texto é o que
   * se lê sobre ela: `corDeAvatar` garante 4.5:1.
   */
  readonly cor = input<string | null | undefined>(null);

  protected readonly cores = computed(() => {
    const cor = this.cor();
    return cor ? corDeAvatar(cor) : null;
  });
  protected readonly colorido = computed(() => this.cores() !== null);

  protected readonly iniciais = computed(() => iniciaisDe(this.nome()));
}

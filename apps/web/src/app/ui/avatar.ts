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
  },
})
export class Avatar {
  readonly nome = input.required<string>();
  readonly tamanho = input<TamanhoDoAvatar>('m');

  protected readonly iniciais = computed(() => iniciaisDe(this.nome()));
}

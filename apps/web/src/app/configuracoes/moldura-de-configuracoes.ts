/**
 * A moldura das telas de configuração: topo, menu lateral e o conteúdo.
 *
 * Aparência, Preferências, Perfil e Segurança são páginas irmãs sob o mesmo menu, e não mais
 * duas telas soltas: o editor de tema ganha uma página inteira, com a prévia ao
 * vivo valendo no app todo. O campo de estrelas do fundo fica atrás, para o
 * efeito de "Estrelas" aparecer onde a pessoa está editando.
 */
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
} from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { Botao } from '../ui/botao';
import { CabecalhoDePagina } from '../ui/cabecalho-de-pagina';
import { FundoOrbital } from '../ui/fundo-orbital';
import { Marca } from '../ui/marca';

@Component({
  selector: 'nb-moldura-de-configuracoes',
  imports: [
    Botao,
    CabecalhoDePagina,
    FundoOrbital,
    Marca,
    RouterLink,
    RouterLinkActive,
  ],
  templateUrl: './moldura-de-configuracoes.html',
  styleUrl: './moldura-de-configuracoes.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MolduraDeConfiguracoes {
  private readonly router = inject(Router);

  readonly titulo = input.required<string>();

  protected readonly areas = [
    { rota: '/aparencia', rotulo: 'Aparência' },
    { rota: '/preferencias', rotulo: 'Preferências' },
    { rota: '/perfil', rotulo: 'Perfil' },
    { rota: '/seguranca', rotulo: 'Segurança' },
  ] as const;

  protected voltar(): void {
    void this.router.navigateByUrl('/');
  }
}

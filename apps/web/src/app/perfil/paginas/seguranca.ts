/**
 * A área de Segurança: e-mail, senha, aparelhos conectados e apagar a conta.
 *
 * Saiu do Perfil para cada tela ter um assunto: o Perfil é quem a pessoa é
 * (nome, handle, cor) e esta é o que protege a conta. Cada seção já traz o
 * próprio formulário e o próprio estado; esta página só as reúne.
 */
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MolduraDeConfiguracoes } from '../../configuracoes/moldura-de-configuracoes';
import { CartaoDeSecao } from '../../ui/cartao-de-secao';
import { ApagarConta } from '../apagar-conta';
import { SessoesAtivas } from '../sessoes-ativas';
import { TrocaDeEmail } from '../troca-de-email';
import { TrocaDeSenha } from '../troca-de-senha';

@Component({
  selector: 'nb-seguranca',
  imports: [
    ApagarConta,
    CartaoDeSecao,
    MolduraDeConfiguracoes,
    SessoesAtivas,
    TrocaDeEmail,
    TrocaDeSenha,
  ],
  templateUrl: './seguranca.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Seguranca {}

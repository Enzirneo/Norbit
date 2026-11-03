/**
 * O envio de e-mail, atrás de uma interface pequena.
 *
 * Em desenvolvimento o destino é o Mailpit (`docker-compose`), que captura tudo
 * e não entrega a ninguém. Em produção basta apontar `SMTP_*` para um provedor:
 * nada acima desta classe sabe qual é.
 */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';

export type Mensagem = {
  readonly para: string;
  readonly assunto: string;
  readonly texto: string;
};

export type PedidoDeRedefinicao = {
  readonly para: string;
  readonly nome: string;
  readonly token: string;
};

export type PedidoDeConvite = {
  readonly para: string;
  readonly convidadoPor: string;
  readonly agenda: string;
  /** O papel já em português, como a pessoa vai ler. */
  readonly papel: string;
  readonly link: string;
  readonly expiraEm: Date;
};

@Injectable()
export class EmailService {
  private readonly transporte: Transporter;
  private readonly remetente: string;
  private readonly origemDaWeb: string;

  constructor(config: ConfigService) {
    this.origemDaWeb = config.get<string>(
      'WEB_ORIGIN',
      'http://localhost:4200',
    );
    const usuario = config.get<string>('SMTP_USER', '');
    const senha = config.get<string>('SMTP_PASSWORD', '');

    this.remetente = config.get<string>(
      'MAIL_FROM',
      'Norbit <nao-responda@norbit.app>',
    );
    this.transporte = createTransport({
      host: config.get<string>('SMTP_HOST', 'localhost'),
      port: Number(config.get<string>('SMTP_PORT', '1025')),
      secure: config.get<string>('SMTP_SECURE', 'false') === 'true',
      // Mailpit não tem autenticação, e mandar credencial vazia faria alguns
      // servidores recusarem a conexão.
      auth: usuario ? { user: usuario, pass: senha } : undefined,
    });
  }

  /**
   * O e-mail do link de redefinição.
   *
   * Mora aqui, e não no serviço de redefinição, porque é quem conhece a origem
   * da web — o link aponta para uma tela do Angular, não para a API.
   */
  async enviarRedefinicaoDeSenha(pedido: PedidoDeRedefinicao): Promise<void> {
    await this.enviar({
      para: pedido.para,
      assunto: 'Redefinir sua senha do Norbit',
      texto: [
        `Olá, ${pedido.nome}.`,
        '',
        'Alguém pediu para redefinir a senha da sua conta no Norbit. Se foi você, abra o link abaixo (vale por 30 minutos):',
        '',
        `${this.origemDaWeb}/redefinir-senha?token=${pedido.token}`,
        '',
        'Se não foi você, ignore esta mensagem: a sua senha continua a mesma.',
      ].join('\n'),
    });
  }

  /** O endereço da tela que aceita o convite, com o token na query. */
  linkDoConvite(token: string): string {
    return `${this.origemDaWeb}/convite?token=${token}`;
  }

  async enviarConvite(pedido: PedidoDeConvite): Promise<void> {
    const prazo = pedido.expiraEm.toLocaleDateString('pt-BR');

    await this.enviar({
      para: pedido.para,
      assunto: `${pedido.convidadoPor} convidou você para uma agenda no Norbit`,
      texto: [
        `${pedido.convidadoPor} convidou você para a agenda "${pedido.agenda}" no Norbit, como ${pedido.papel}.`,
        '',
        `Para aceitar (ou recusar), abra o link abaixo. O convite vale até ${prazo}:`,
        '',
        pedido.link,
        '',
        'Se você não conhece essa pessoa, ignore esta mensagem.',
      ].join('\n'),
    });
  }

  async enviar(mensagem: Mensagem): Promise<void> {
    await this.transporte.sendMail({
      from: this.remetente,
      to: mensagem.para,
      subject: mensagem.assunto,
      text: mensagem.texto,
    });
  }
}

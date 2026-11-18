/**
 * Trocar o e-mail da conta, em dois passos.
 *
 * O e-mail é o destino da recuperação de senha: quem o controla controla a
 * conta. Por isso a troca pede a **senha** (quem pegasse um aparelho
 * desbloqueado não a faz) e só vale depois de um link enviado ao endereço
 * **novo**, que prova que a pessoa o controla. Até o clique, nada muda.
 *
 * A validade e o uso único do link seguem a regra da redefinição de senha
 * (`avaliarRedefinicao`): é a mesma credencial de curta duração.
 */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@norbit/db';
import { avaliarRedefinicao, expiracaoDoLink } from '@norbit/domain';
import { uuidv7 } from 'uuidv7';
import { EmailService } from '../comum/email.service';
import { conflitoDeCadastro } from './conflito-de-cadastro';
import { SenhasService } from './senhas.service';
import { TokensService } from './tokens.service';

const SENHA_INCORRETA = 'A senha está incorreta.';
const MESMO_EMAIL = 'Esse já é o e-mail da sua conta.';
const LINK_EXPIRADO = 'Este link expirou. Peça um novo.';

/** Desconhecido e já usado dão a mesma resposta, como na redefinição de senha. */
const LINK_INVALIDO = 'Link inválido ou já usado. Peça um novo.';

const ENDERECO_INDISPONIVEL =
  'Este endereço não pode mais ser usado. Peça a troca para outro.';

@Injectable()
export class TrocaDeEmailService {
  private readonly logger = new Logger(TrocaDeEmailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly senhas: SenhasService,
    private readonly tokens: TokensService,
    private readonly email: EmailService,
  ) {}

  /**
   * Responde igual haja ou não conta no endereço novo: a pessoa está logada, mas
   * dizer "esse e-mail já tem conta" daria a qualquer sessão (inclusive uma
   * roubada) um jeito de descobrir quem usa o Norbit. Se o endereço já tem
   * dono, nada é gravado nem enviado.
   *
   * O envio não é aguardado, pelo mesmo motivo da redefinição de senha.
   */
  async pedir(entrada: {
    readonly userId: string;
    readonly senha: string;
    readonly novoEmail: string;
  }): Promise<void> {
    const usuario = await this.prisma.user.findFirst({
      where: { id: entrada.userId, deletedAt: null },
    });
    if (
      !usuario?.passwordHash ||
      !(await this.senhas.conferir(usuario.passwordHash, entrada.senha))
    ) {
      throw new BadRequestException(SENHA_INCORRETA);
    }
    if (usuario.email.toLowerCase() === entrada.novoEmail) {
      throw new BadRequestException(MESMO_EMAIL);
    }

    const dono = await this.prisma.user.findFirst({
      where: { email: entrada.novoEmail },
      select: { id: true },
    });
    if (dono) {
      return;
    }

    const token = await this.registrar(usuario.id, entrada.novoEmail);

    void this.email
      .enviarConfirmacaoDeEmail({
        para: entrada.novoEmail,
        nome: usuario.displayName,
        token,
      })
      .catch((erro: unknown) => {
        this.logger.error(
          `Falha ao enviar a confirmação de e-mail: ${String(erro)}`,
        );
      });
  }

  /**
   * Grava o pedido e devolve o token cru, que só existe a caminho do e-mail.
   *
   * Um pedido novo cancela os anteriores: dois links vivos para a mesma conta
   * dobrariam a superfície sem ajudar ninguém.
   */
  private async registrar(userId: string, novoEmail: string): Promise<string> {
    const token = this.tokens.gerarTokenOpaco();
    const agora = new Date();

    await this.prisma.$transaction([
      this.prisma.emailChange.updateMany({
        where: { userId, usedAt: null },
        data: { usedAt: agora },
      }),
      this.prisma.emailChange.create({
        data: {
          id: uuidv7(),
          userId,
          newEmail: novoEmail,
          tokenHash: token.hash,
          expiresAt: expiracaoDoLink(agora),
        },
      }),
    ]);

    return token.valor;
  }

  /**
   * Efetiva a troca. Pública como a redefinição: quem clica pode estar em outro
   * aparelho, sem sessão.
   *
   * Derruba **todas** as sessões: não há sessão atual a poupar, e trocar o
   * e-mail é mexer na recuperação da conta. A pessoa entra de novo com o
   * endereço novo. Também invalida links de redefinição de senha em aberto, que
   * foram enviados ao endereço antigo.
   */
  async confirmar(token: string): Promise<void> {
    const agora = new Date();
    const pedido = await this.prisma.emailChange.findUnique({
      where: { tokenHash: this.tokens.hashDoToken(token) },
    });

    const decisao = avaliarRedefinicao(pedido, agora);
    if (decisao.tipo === 'expirado') {
      throw new BadRequestException(LINK_EXPIRADO);
    }
    if (decisao.tipo !== 'aceitar' || !pedido) {
      throw new BadRequestException(LINK_INVALIDO);
    }

    const antigo = await this.efetivar(pedido, agora);

    void this.email
      .enviarAvisoDeTrocaDeEmail({
        para: antigo.email,
        nome: antigo.displayName,
        novoEmail: pedido.newEmail,
      })
      .catch((erro: unknown) => {
        this.logger.error(`Falha ao avisar o e-mail antigo: ${String(erro)}`);
      });
  }

  private async efetivar(
    pedido: { id: string; userId: string; newEmail: string },
    agora: Date,
  ): Promise<{ email: string; displayName: string }> {
    const usuario = await this.prisma.user.findFirst({
      where: { id: pedido.userId, deletedAt: null },
      select: { email: true, displayName: true },
    });
    if (!usuario) {
      throw new BadRequestException(LINK_INVALIDO);
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        // Marcar como usado é o que decide a corrida: só um dos cliques
        // simultâneos encontra `usedAt` nulo e altera uma linha.
        const marcado = await tx.emailChange.updateMany({
          where: { id: pedido.id, usedAt: null },
          data: { usedAt: agora },
        });
        if (marcado.count !== 1) {
          throw new BadRequestException(LINK_INVALIDO);
        }

        await tx.user.update({
          where: { id: pedido.userId },
          data: { email: pedido.newEmail, emailVerifiedAt: agora },
        });
        await tx.session.updateMany({
          where: { userId: pedido.userId, revokedAt: null },
          data: { revokedAt: agora },
        });
        await tx.passwordReset.updateMany({
          where: { userId: pedido.userId, usedAt: null },
          data: { usedAt: agora },
        });
      });
    } catch (erro) {
      // Alguém cadastrou o endereço entre o pedido e o clique.
      if (conflitoDeCadastro(erro) instanceof ConflictException) {
        throw new BadRequestException(ENDERECO_INDISPONIVEL);
      }
      throw erro;
    }

    return usuario;
  }
}

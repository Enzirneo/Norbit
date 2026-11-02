/**
 * Recuperação de senha: pedir o link e usá-lo.
 *
 * A decisão sobre o link está em `avaliarRedefinicao` (`libs/domain`); este
 * serviço persiste a consequência dela.
 */
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@norbit/db';
import { avaliarRedefinicao, expiracaoDoLink } from '@norbit/domain';
import { uuidv7 } from 'uuidv7';
import { EmailService } from '../comum/email.service';
import { SenhasService } from './senhas.service';
import { TokensService } from './tokens.service';

const LINK_EXPIRADO = 'Este link expirou. Peça um novo.';

/**
 * Link desconhecido e link já usado dão a mesma resposta: a diferença não
 * ajuda quem tem o link legítimo e daria a quem não tem uma pista sobre o que
 * já foi emitido.
 */
const LINK_INVALIDO = 'Link inválido ou já usado. Peça um novo.';

@Injectable()
export class RedefinicaoDeSenhaService {
  private readonly logger = new Logger(RedefinicaoDeSenhaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly senhas: SenhasService,
    private readonly tokens: TokensService,
    private readonly email: EmailService,
  ) {}

  /**
   * Sempre resolve do mesmo jeito, haja conta ou não.
   *
   * Quem pede não descobre se o e-mail tem conta no Norbit. O envio não é
   * aguardado pelo mesmo motivo: esperar o servidor SMTP só quando a conta
   * existe tornaria a resposta mais lenta para e-mails reais, e o tempo seria o
   * oráculo que a resposta idêntica fechou.
   */
  async pedir(emailInformado: string): Promise<void> {
    const usuario = await this.prisma.user.findFirst({
      where: { email: emailInformado, deletedAt: null },
    });
    if (!usuario) {
      return;
    }

    const token = this.tokens.gerarTokenOpaco();
    const agora = new Date();

    // Um pedido novo cancela os anteriores: dois links vivos para a mesma conta
    // dobrariam a superfície sem ajudar ninguém.
    await this.prisma.$transaction([
      this.prisma.passwordReset.updateMany({
        where: { userId: usuario.id, usedAt: null },
        data: { usedAt: agora },
      }),
      this.prisma.passwordReset.create({
        data: {
          id: uuidv7(),
          userId: usuario.id,
          tokenHash: token.hash,
          expiresAt: expiracaoDoLink(agora),
        },
      }),
    ]);

    void this.email
      .enviarRedefinicaoDeSenha({
        para: usuario.email,
        nome: usuario.displayName,
        token: token.valor,
      })
      .catch((erro: unknown) => {
        // O pedido já foi aceito e a resposta já saiu: a falha vai para o log,
        // não para a pessoa — contar a ela distinguiria conta de não-conta.
        this.logger.error(
          `Falha ao enviar o e-mail de redefinição: ${String(erro)}`,
        );
      });
  }

  async redefinir(token: string, novaSenha: string): Promise<void> {
    const agora = new Date();
    const link = await this.prisma.passwordReset.findUnique({
      where: { tokenHash: this.tokens.hashDoToken(token) },
    });

    const decisao = avaliarRedefinicao(link, agora);
    if (decisao.tipo === 'expirado') {
      throw new BadRequestException(LINK_EXPIRADO);
    }
    if (decisao.tipo !== 'aceitar' || !link) {
      throw new BadRequestException(LINK_INVALIDO);
    }

    const passwordHash = await this.senhas.gerarHash(novaSenha);

    await this.prisma.$transaction(async (tx) => {
      // Marcar como usado é o que decide a corrida: só um dos pedidos
      // simultâneos encontra `usedAt` nulo e altera uma linha.
      const marcado = await tx.passwordReset.updateMany({
        where: { id: link.id, usedAt: null },
        data: { usedAt: agora },
      });
      if (marcado.count !== 1) {
        throw new BadRequestException(LINK_INVALIDO);
      }

      await tx.user.update({
        where: { id: link.userId },
        data: { passwordHash },
      });
      await tx.session.updateMany({
        where: { userId: link.userId, revokedAt: null },
        data: { revokedAt: agora },
      });
    });
  }
}

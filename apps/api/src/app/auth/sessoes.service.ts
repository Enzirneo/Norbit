/**
 * Os aparelhos em que a conta está aberta, e como derrubar um deles.
 *
 * Um aparelho é uma **família** de sessões: cada renovação revoga a linha
 * anterior e cria outra, então a linha viva de uma família (não revogada, não
 * vencida) é a única que diz de onde a pessoa está entrando agora.
 */
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@norbit/db';
import type { SessaoAtiva } from '@norbit/contracts';
import { TokensService } from './tokens.service';

const SESSAO_NAO_ENCONTRADA = 'Sessão não encontrada.';

const SESSAO_ATUAL =
  'Esta é a sessão deste aparelho. Para encerrá-la, use Sair.';

@Injectable()
export class SessoesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokensService,
  ) {}

  /**
   * `refreshToken` serve só para marcar qual item é o aparelho de quem pediu;
   * sem ele (ou com o de outra conta) nenhum item vem marcado.
   */
  async listar(entrada: {
    readonly userId: string;
    readonly refreshToken: string | undefined;
  }): Promise<SessaoAtiva[]> {
    const vivas = await this.prisma.session.findMany({
      where: {
        userId: entrada.userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    const familiaAtual = await this.familiaDoRefresh(
      entrada.userId,
      entrada.refreshToken,
    );

    return vivas.map((sessao) => ({
      id: sessao.familyId,
      userAgent: sessao.userAgent,
      ipAddress: sessao.ipAddress,
      ultimoUsoEm: sessao.createdAt.toISOString(),
      atual: sessao.familyId === familiaAtual,
    }));
  }

  /**
   * Derruba um aparelho **que não é este**: encerrar o próprio é o `Sair`, que
   * também limpa o cookie, e aqui deixaria a pessoa com um cookie morto.
   *
   * Sessão de outra conta e sessão que já acabou respondem igual (404), para
   * o identificador não servir de sonda.
   */
  async revogar(entrada: {
    readonly userId: string;
    readonly sessaoId: string;
    readonly refreshToken: string | undefined;
  }): Promise<void> {
    const viva = await this.prisma.session.findFirst({
      where: {
        userId: entrada.userId,
        familyId: entrada.sessaoId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });
    if (!viva) {
      throw new NotFoundException(SESSAO_NAO_ENCONTRADA);
    }

    const familiaAtual = await this.familiaDoRefresh(
      entrada.userId,
      entrada.refreshToken,
    );
    if (familiaAtual === entrada.sessaoId) {
      throw new BadRequestException(SESSAO_ATUAL);
    }

    await this.prisma.session.updateMany({
      where: {
        userId: entrada.userId,
        familyId: entrada.sessaoId,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  }

  /** A família do refresh apresentado, se ele for mesmo desta conta e estiver vivo. */
  private async familiaDoRefresh(
    userId: string,
    refreshToken: string | undefined,
  ): Promise<string | null> {
    if (!refreshToken) {
      return null;
    }

    const sessao = await this.prisma.session.findFirst({
      where: {
        userId,
        refreshTokenHash: this.tokens.hashDeRefresh(refreshToken),
        revokedAt: null,
      },
      select: { familyId: true },
    });
    return sessao?.familyId ?? null;
  }
}

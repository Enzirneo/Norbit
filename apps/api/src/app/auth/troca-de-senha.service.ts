/**
 * Trocar a senha estando logado.
 *
 * Difere da redefinição por link em quem prova o quê: lá a prova é o link do
 * e-mail; aqui a pessoa já tem sessão, e a prova que falta é a **senha atual**.
 * Sem ela, quem pegasse um aparelho desbloqueado trocaria a senha e trancaria
 * a dona da conta do lado de fora.
 */
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '@norbit/db';
import { SenhasService } from './senhas.service';
import { TokensService } from './tokens.service';

/** Uma só mensagem: não há o que distinguir entre "não existe" e "não confere". */
const SENHA_ATUAL_INCORRETA = 'A senha atual está incorreta.';

@Injectable()
export class TrocaDeSenhaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly senhas: SenhasService,
    private readonly tokens: TokensService,
  ) {}

  /**
   * Grava a senha nova e derruba as sessões de **todos os outros aparelhos**.
   *
   * Quem trocou a senha porque suspeita de acesso alheio precisa que o acesso
   * alheio acabe; manter as sessões antigas deixaria a troca sem efeito sobre
   * quem já estava dentro. A sessão deste aparelho fica, para a pessoa não ser
   * deslogada no meio do que fez de propósito.
   *
   * Sem como identificar a sessão atual (cookie ausente, ou de outra conta),
   * derruba todas: na dúvida, fecha.
   */
  async trocar(entrada: {
    readonly userId: string;
    readonly senhaAtual: string;
    readonly novaSenha: string;
    readonly refreshToken: string | undefined;
  }): Promise<void> {
    const usuario = await this.prisma.user.findFirst({
      where: { id: entrada.userId, deletedAt: null },
    });
    // Conta sem senha (criada só por OAuth, previsto para o futuro) não tem o que conferir:
    // cai na mesma recusa, em vez de um erro que distinguiria os dois casos.
    if (
      !usuario?.passwordHash ||
      !(await this.senhas.conferir(usuario.passwordHash, entrada.senhaAtual))
    ) {
      throw new BadRequestException(SENHA_ATUAL_INCORRETA);
    }

    const passwordHash = await this.senhas.gerarHash(entrada.novaSenha);
    const familiaAtual = await this.familiaDaSessao(
      entrada.userId,
      entrada.refreshToken,
    );

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: usuario.id },
        data: { passwordHash },
      }),
      this.prisma.session.updateMany({
        where: {
          userId: usuario.id,
          revokedAt: null,
          ...(familiaAtual ? { familyId: { not: familiaAtual } } : {}),
        },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  /** A família do refresh deste aparelho, se ele for mesmo desta conta. */
  private async familiaDaSessao(
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

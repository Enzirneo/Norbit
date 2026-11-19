/**
 * As preferências da conta.
 *
 * `UserSettings` existe no banco desde a primeira migration e não era exposto —
 * a consequência era uma tela que sempre abria no mês e sempre começava a semana
 * no domingo, ignorando o que o modelo já sabia guardar.
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import {
  TEMA_PADRAO,
  temaLegado,
  temaSchema,
  type AtualizarPreferencias,
  type PreferenciasVisiveis,
  type Tema,
} from '@norbit/contracts';
import { PrismaService, type Prisma, type UserSettings } from '@norbit/db';

@Injectable()
export class PreferenciasService {
  constructor(private readonly prisma: PrismaService) {}

  async minhas(userId: string): Promise<PreferenciasVisiveis> {
    const settings = await this.prisma.userSettings.findUnique({
      where: { userId },
    });

    // O cadastro cria as preferências na mesma transação da conta, então a
    // ausência aqui é defeito de dado — não um caso a contornar com padrões,
    // que esconderia a causa e faria a tela parecer funcionar.
    if (!settings) {
      throw new NotFoundException('Preferências não encontradas.');
    }

    return visiveis(settings);
  }

  async atualizar(
    userId: string,
    dados: AtualizarPreferencias,
  ): Promise<PreferenciasVisiveis> {
    const { tema, ...resto } = dados;
    const data: Prisma.UserSettingsUpdateInput = { ...resto };

    if (tema) {
      // O par antigo continua em dia até a web deixar de lê-lo: o destaque do
      // tema é o `accentColor`.
      data.appearance = tema;
      data.accentColor = tema.sementes.destaque;
    } else if (resto.accentColor) {
      await this.acompanharDestaque(userId, resto.accentColor, data);
    }

    const atualizadas = await this.prisma.userSettings.update({
      where: { userId },
      data,
    });

    return visiveis(atualizadas);
  }

  /**
   * Trocar só o `accentColor` (como a tela de hoje faz) também troca o destaque
   * do tema guardado, para os dois nunca discordarem. Sem tema guardado, nada a
   * fazer: a leitura o deriva do par antigo.
   */
  private async acompanharDestaque(
    userId: string,
    destaque: string,
    data: Prisma.UserSettingsUpdateInput,
  ): Promise<void> {
    const atual = await this.prisma.userSettings.findUnique({
      where: { userId },
    });
    const guardado = atual ? lerTema(atual.appearance) : null;

    if (guardado) {
      data.appearance = {
        ...guardado,
        sementes: { ...guardado.sementes, destaque },
      };
    }
  }
}

/** O tema guardado, ou `null` se não há ou ficou inválido. */
function lerTema(guardado: unknown): Tema | null {
  const lido = temaSchema.safeParse(guardado);
  return lido.success ? lido.data : null;
}

/**
 * Só os campos que a interface usa.
 *
 * `theme`, `themePreset` e os de notificação ficam de fora de propósito:
 * devolver um campo que nada lê convida a construir contra ele antes de a
 * funcionalidade existir.
 */
function visiveis(settings: UserSettings): PreferenciasVisiveis {
  return {
    accentColor: settings.accentColor,
    tema: temaDe(settings),
    density: settings.density,
    reducedMotion: settings.reducedMotion,
    defaultView: settings.defaultView,
    weekStartsOn: settings.weekStartsOn,
    use24Hour: settings.use24Hour,
  };
}

/**
 * O tema da conta: o guardado; se não há, o derivado do par antigo; se o
 * guardado ficou inválido (versão futura, dado corrompido), o padrão. Ler nunca
 * deve falhar por causa disso.
 */
function temaDe(settings: UserSettings): Tema {
  if (settings.appearance === null) {
    return temaLegado(settings.themePreset, settings.accentColor);
  }

  return lerTema(settings.appearance) ?? TEMA_PADRAO;
}

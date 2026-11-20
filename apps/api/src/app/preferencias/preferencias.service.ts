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
  temaSchema,
  type AtualizarPreferencias,
  type PreferenciasVisiveis,
  type Tema,
} from '@norbit/contracts';
import { PrismaService, type UserSettings } from '@norbit/db';

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

    const atualizadas = await this.prisma.userSettings.update({
      where: { userId },
      data: { ...resto, ...(tema && { appearance: tema }) },
    });

    return visiveis(atualizadas);
  }
}

/**
 * Só os campos que a interface usa.
 *
 * `theme` e os de notificação ficam de fora de propósito:
 * devolver um campo que nada lê convida a construir contra ele antes de a
 * funcionalidade existir.
 */
function visiveis(settings: UserSettings): PreferenciasVisiveis {
  return {
    tema: temaDe(settings),
    density: settings.density,
    reducedMotion: settings.reducedMotion,
    defaultView: settings.defaultView,
    weekStartsOn: settings.weekStartsOn,
    use24Hour: settings.use24Hour,
  };
}

/**
 * O tema da conta: o guardado, ou o padrão se ele ficou inválido (versão
 * futura, dado corrompido). Ler nunca deve falhar por causa disso.
 */
function temaDe(settings: UserSettings): Tema {
  const lido = temaSchema.safeParse(settings.appearance);
  return lido.success ? lido.data : TEMA_PADRAO;
}

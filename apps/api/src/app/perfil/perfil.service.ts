/**
 * O perfil de quem está logado.
 *
 * Só os campos que a pessoa pode alterar sozinha: nome, handle e fuso. O e-mail
 * e a senha têm fluxos próprios.
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import type { AtualizarPerfil, UsuarioAutenticado } from '@norbit/contracts';
import { PrismaService } from '@norbit/db';
import { paraUsuarioAutenticado } from '../auth/auth.service';
import { conflitoDeCadastro } from '../auth/conflito-de-cadastro';

const NAO_ENCONTRADA = 'Conta não encontrada.';

@Injectable()
export class PerfilService {
  constructor(private readonly prisma: PrismaService) {}

  async atualizar(
    userId: string,
    dados: AtualizarPerfil,
  ): Promise<UsuarioAutenticado> {
    // `updateMany` com `deletedAt: null` em vez de `update`: o `update` só
    // aceita a chave única no filtro, e uma conta apagada não deve ser editável
    // por um token que ainda não expirou.
    const alterados = await this.prisma.user
      .updateMany({ where: { id: userId, deletedAt: null }, data: dados })
      .catch((erro: unknown) => {
        throw conflitoDeCadastro(erro);
      });
    if (alterados.count !== 1) {
      throw new NotFoundException(NAO_ENCONTRADA);
    }

    const usuario = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });
    if (!usuario) {
      throw new NotFoundException(NAO_ENCONTRADA);
    }
    return paraUsuarioAutenticado(usuario);
  }
}

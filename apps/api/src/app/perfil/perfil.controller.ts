/**
 * O perfil de quem está pedindo. Sem identificador na URL, como as preferências:
 * um `/usuarios/:id` convidaria a tentar o perfil de outra pessoa.
 */
import { Body, Controller, Patch, UseGuards } from '@nestjs/common';
import {
  atualizarPerfilSchema,
  type AtualizarPerfil,
  type UsuarioAutenticado,
} from '@norbit/contracts';
import { AuthGuard } from '../auth/auth.guard';
import type { Requisitante } from '../auth/auth.guard';
import { UsuarioAtual } from '../auth/usuario-atual.decorator';
import { ZodValidationPipe } from '../comum/zod-validation.pipe';
import { PerfilService } from './perfil.service';

@Controller('perfil')
@UseGuards(AuthGuard)
export class PerfilController {
  constructor(private readonly perfil: PerfilService) {}

  @Patch()
  async atualizar(
    @UsuarioAtual() quem: Requisitante,
    @Body(new ZodValidationPipe(atualizarPerfilSchema))
    dados: AtualizarPerfil,
  ): Promise<UsuarioAutenticado> {
    return this.perfil.atualizar(quem.id, dados);
  }
}

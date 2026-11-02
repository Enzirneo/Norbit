/**
 * As rotas das preferências da conta.
 *
 * Sem identificador na URL: as preferências são sempre de quem está pedindo, e
 * um `/usuarios/:id/preferencias` convidaria a tentar as de outra pessoa.
 */
import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import {
  atualizarPreferenciasSchema,
  type AtualizarPreferencias,
  type PreferenciasVisiveis,
} from '@norbit/contracts';
import { AuthGuard } from '../auth/auth.guard';
import type { Requisitante } from '../auth/auth.guard';
import { UsuarioAtual } from '../auth/usuario-atual.decorator';
import { ZodValidationPipe } from '../comum/zod-validation.pipe';
import { PreferenciasService } from './preferencias.service';

@Controller('preferencias')
@UseGuards(AuthGuard)
export class PreferenciasController {
  constructor(private readonly preferencias: PreferenciasService) {}

  @Get()
  async minhas(
    @UsuarioAtual() quem: Requisitante,
  ): Promise<PreferenciasVisiveis> {
    return this.preferencias.minhas(quem.id);
  }

  @Patch()
  async atualizar(
    @UsuarioAtual() quem: Requisitante,
    @Body(new ZodValidationPipe(atualizarPreferenciasSchema))
    dados: AtualizarPreferencias,
  ): Promise<PreferenciasVisiveis> {
    return this.preferencias.atualizar(quem.id, dados);
  }
}

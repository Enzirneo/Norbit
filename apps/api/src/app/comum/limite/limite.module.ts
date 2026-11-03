import { Module } from '@nestjs/common';
import { LimiteGuard } from './limite.guard';
import { LimiteService } from './limite.service';

/**
 * Um módulo só, e um `LimiteService` só: os contadores precisam ser
 * compartilhados por todas as rotas, e duas instâncias contariam separado.
 */
@Module({
  providers: [LimiteService, LimiteGuard],
  exports: [LimiteService, LimiteGuard],
})
export class LimiteModule {}

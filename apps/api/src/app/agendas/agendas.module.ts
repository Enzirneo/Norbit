/**
 * O módulo das agendas.
 *
 * Exporta o `AcessoService` porque ele é a autorização de todo o produto, e o
 * módulo de eventos depende dele. Exportar só isso mantém a regra num lugar: o
 * de eventos não alcança o `AgendasService` e não tem como contornar o `abrir`.
 */
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AcessoService } from './acesso.service';
import { AgendasController } from './agendas.controller';
import { AgendasService } from './agendas.service';

@Module({
  imports: [AuthModule],
  controllers: [AgendasController],
  providers: [AcessoService, AgendasService],
  exports: [AcessoService],
})
export class AgendasModule {}

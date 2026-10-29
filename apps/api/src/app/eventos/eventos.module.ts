import { Module } from '@nestjs/common';
import { AgendasModule } from '../agendas/agendas.module';
import { AuthModule } from '../auth/auth.module';
import { EventosController } from './eventos.controller';
import { EventosService } from './eventos.service';

@Module({
  imports: [AuthModule, AgendasModule],
  controllers: [EventosController],
  providers: [EventosService],
})
export class EventosModule {}

import { Module } from '@nestjs/common';
import { AgendasModule } from '../agendas/agendas.module';
import { AuthModule } from '../auth/auth.module';
import { PosicionamentoService } from './posicionamento.service';
import { TarefasController } from './tarefas.controller';
import { TarefasService } from './tarefas.service';

@Module({
  imports: [AuthModule, AgendasModule],
  controllers: [TarefasController],
  providers: [TarefasService, PosicionamentoService],
})
export class TarefasModule {}

import { Module } from '@nestjs/common';
import { AgendasModule } from '../agendas/agendas.module';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../comum/email.module';
import { LimiteModule } from '../comum/limite/limite.module';
import {
  ConvitesController,
  ConvitesDaAgendaController,
} from './convites.controller';
import { ConvitesService } from './convites.service';

@Module({
  imports: [AuthModule, AgendasModule, EmailModule, LimiteModule],
  controllers: [ConvitesDaAgendaController, ConvitesController],
  providers: [ConvitesService],
})
export class ConvitesModule {}

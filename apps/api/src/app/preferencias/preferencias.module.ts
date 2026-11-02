import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PreferenciasController } from './preferencias.controller';
import { PreferenciasService } from './preferencias.service';

@Module({
  imports: [AuthModule],
  controllers: [PreferenciasController],
  providers: [PreferenciasService],
})
export class PreferenciasModule {}

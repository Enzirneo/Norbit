import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PerfilController } from './perfil.controller';
import { PerfilService } from './perfil.service';

@Module({
  imports: [AuthModule],
  controllers: [PerfilController],
  providers: [PerfilService],
})
export class PerfilModule {}

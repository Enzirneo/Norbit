import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '@norbit/db';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AgendasModule } from './agendas/agendas.module';
import { AuthModule } from './auth/auth.module';
import { EventosModule } from './eventos/eventos.module';

@Module({
  imports: [
    // `isGlobal` para não repetir o import em cada módulo; o `.env` da raiz é
    // lido uma vez na subida.
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    AgendasModule,
    EventosModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

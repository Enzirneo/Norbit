/**
 * Módulo global do banco.
 *
 * É global porque praticamente todo módulo de domínio precisa do Prisma, e a
 * alternativa seria repetir o import em cada um — ruído sem contrapartida.
 */
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}

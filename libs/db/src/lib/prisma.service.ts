/**
 * O Prisma Client como provider do Nest, com o ciclo de vida amarrado ao do
 * módulo.
 *
 * Sem `onModuleDestroy`, as conexões ficariam abertas a cada reinício em
 * desenvolvimento até o Postgres recusar novas por esgotar `max_connections` —
 * um erro que aparece como "banco fora do ar" e custa caro para diagnosticar.
 */
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/client/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const connectionString = process.env.DATABASE_URL;

    // Falhar aqui, na construção, é deliberado: sem a URL a aplicação não tem
    // como funcionar, e o erro na subida é muito mais barato que o mesmo erro
    // na primeira consulta de um usuário.
    if (!connectionString) {
      throw new Error(
        'DATABASE_URL não está definida. Copie o .env.example para .env.',
      );
    }

    // O Prisma 7 exige um driver adapter para conexão direta: passar só a URL
    // não basta mais.
    super({ adapter: new PrismaPg({ connectionString }) });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Conectado ao Postgres');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

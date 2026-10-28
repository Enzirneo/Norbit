/**
 * Teste de integração, contra o Postgres de verdade.
 *
 * Um mock do Prisma aqui testaria o mock: não provaria que o driver adapter
 * está ligado corretamente, que é justamente a parte que o Prisma 7 passou a
 * exigir e que mais custou a acertar na Fase 0.
 */
import 'dotenv/config';
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  let service: PrismaService;

  beforeEach(() => {
    service = new PrismaService();
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  it('conecta ao banco e responde a uma consulta', async () => {
    await service.onModuleInit();

    const resultado = await service.$queryRaw`SELECT 1 AS um`;

    expect(resultado).toEqual([{ um: 1 }]);
  });

  it('expõe os modelos do schema como propriedades tipadas', async () => {
    await service.onModuleInit();

    // Se o client gerado não estiver sendo reexportado de verdade, isto é
    // `undefined` e o erro só apareceria no primeiro repositório da Fase 1.
    expect(service.user).toBeDefined();
    expect(service.calendar).toBeDefined();
    expect(service.event).toBeDefined();
  });

  it('falha de forma explícita quando DATABASE_URL não está definida', () => {
    const original = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;

    try {
      expect(() => new PrismaService()).toThrow(/DATABASE_URL/);
    } finally {
      process.env.DATABASE_URL = original;
    }
  });
});

/**
 * Ponto de entrada da API.
 *
 * Ainda é o esqueleto gerado pelo Nx: a aplicação de verdade começa na Fase 1.
 */

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);
  const port = process.env.PORT || 3000;
  await app.listen(port);
  // Set when Nx waits for this server to be ready
  if (process.env.NX_READY_SIGNAL_SOCKET) {
    try {
      // Function keeps TypeScript and bundlers from rewriting or bundling the import
      const load = new Function('s', 'return import(s)') as (
        s: string,
      ) => Promise<{ emitReadySignal(server: unknown): boolean }>;
      (await load('@nx/js/ready-signal')).emitReadySignal(app.getHttpServer());
    } catch {
      // @nx/js isn't installed
    }
  }
  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`,
  );
}

// Sem este `catch`, uma falha ao subir (porta ocupada, banco fora do ar)
// viraria unhandled rejection: o Node encerraria com um rastro de pilha que não
// diz o que aconteceu, em vez de uma mensagem e um código de saída.
bootstrap().catch((erro) => {
  Logger.error('Falha ao iniciar a API', erro);
  process.exit(1);
});

/**
 * Ponto de entrada da API.
 */

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app/app.module';

const PREFIXO = 'api';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix(PREFIXO);

  // O refresh token vive num cookie httpOnly; sem este middleware,
  // `request.cookies` é undefined e a renovação nunca encontra a sessão.
  app.use(cookieParser());

  // `credentials: true` é obrigatório para o navegador enviar o cookie numa
  // requisição de outra origem — e a origem é uma lista fechada, de propósito:
  // com `origin: true` qualquer site conseguiria renovar a sessão de quem
  // estivesse logado.
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:4200',
    credentials: true,
  });

  const port = process.env.API_PORT ?? process.env.PORT ?? 3000;
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

  Logger.log(`🚀 API no ar em http://localhost:${port}/${PREFIXO}`);
}

// Sem este `catch`, uma falha ao subir (porta ocupada, banco fora do ar)
// viraria unhandled rejection: o Node encerraria com um rastro de pilha que não
// diz o que aconteceu, em vez de uma mensagem e um código de saída.
bootstrap().catch((erro) => {
  Logger.error('Falha ao iniciar a API', erro);
  process.exit(1);
});

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, type JwtModuleOptions } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { SenhasService } from './senhas.service';
import { TokensService } from './tokens.service';

/** O que o `.env.example` traz como lembrete de trocar. */
const SEGREDO_DE_FACHADA = 'troque-isto';

/**
 * O tipo que o `@nestjs/jwt` aceita em `expiresIn` não é `string`: é um
 * template literal do pacote `ms` (`'15m'`, `'1h'`, `'7d'`…). Derivá-lo do
 * próprio tipo do módulo evita depender de `ms` só para escrever a anotação.
 */
type Expiracao = NonNullable<
  NonNullable<JwtModuleOptions['signOptions']>['expiresIn']
>;

const FORMATO_DE_TTL = /^\d+(ms|s|m|h|d|w|y)$/;

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => ({
        secret: segredoValidado(config),
        signOptions: { expiresIn: ttlValidado(config) },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, SenhasService, TokensService, AuthGuard],
  exports: [AuthService, AuthGuard, TokensService],
})
export class AuthModule {}

/**
 * Recusa subir em produção com o segredo de exemplo.
 *
 * Um JWT assinado com `troque-isto` é um JWT que qualquer pessoa forja: basta
 * ler o `.env.example` no repositório, que é público. Em desenvolvimento o
 * valor passa, porque trocá-lo a cada clone só atrapalha.
 */
function segredoValidado(config: ConfigService): string {
  const segredo = config.get<string>('JWT_ACCESS_SECRET');
  const producao = config.get<string>('NODE_ENV') === 'production';

  if (!segredo) {
    throw new Error('JWT_ACCESS_SECRET não está definida.');
  }

  if (producao && segredo === SEGREDO_DE_FACHADA) {
    throw new Error(
      'JWT_ACCESS_SECRET ainda é o valor de exemplo. Gere um: openssl rand -base64 48',
    );
  }

  return segredo;
}

/**
 * Confere o formato na subida, e não na primeira assinatura.
 *
 * Um `JWT_ACCESS_TTL=15min` (unidade errada) faria o `jsonwebtoken` lançar
 * somente no primeiro login, em produção, parecendo falha de autenticação.
 */
function ttlValidado(config: ConfigService): Expiracao {
  const ttl = config.get<string>('JWT_ACCESS_TTL', '15m');

  if (!FORMATO_DE_TTL.test(ttl)) {
    throw new Error(
      `JWT_ACCESS_TTL inválida: "${ttl}". Use um número e uma unidade, como 15m, 1h ou 7d.`,
    );
  }

  return ttl as Expiracao;
}

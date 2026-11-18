/**
 * O cookie que carrega o refresh token, compartilhado pelas rotas de
 * autenticação, de sessões e de conta.
 */
import type { ConfigService } from '@nestjs/config';
import type { CookieOptions, Request } from 'express';

export const COOKIE_DE_REFRESH = 'norbit_refresh';

/**
 * O caminho restringe onde o cookie é enviado: ele não acompanha toda
 * requisição à API, só as de autenticação. Menos exposição, de graça.
 */
const CAMINHO_DO_COOKIE = '/api/auth';

/**
 * Criar e limpar o cookie exigem as mesmas opções, ou o navegador não encontra
 * qual apagar e a sessão "volta" no próximo refresh.
 */
export function opcoesDoCookie(config: ConfigService): CookieOptions {
  return {
    httpOnly: true,
    // `strict` basta: web e api ficam no mesmo site (porta não conta para o
    // SameSite, e em produção serão subdomínios do mesmo domínio). Se um dia
    // a API mudar de domínio, isto vira `none` com `secure` obrigatório.
    sameSite: 'strict',
    secure: config.get<string>('NODE_ENV') === 'production',
    path: CAMINHO_DO_COOKIE,
  };
}

export function refreshDoCookie(requisicao: Request): string | undefined {
  const cookies: unknown = requisicao.cookies;
  if (typeof cookies !== 'object' || cookies === null) {
    return undefined;
  }

  const valor = (cookies as Record<string, unknown>)[COOKIE_DE_REFRESH];
  return typeof valor === 'string' ? valor : undefined;
}

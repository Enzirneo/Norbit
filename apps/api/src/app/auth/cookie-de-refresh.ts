/**
 * O cookie que carrega o refresh token, compartilhado pelas rotas de
 * autenticação e pelas de sessões.
 */
import type { Request } from 'express';

export const COOKIE_DE_REFRESH = 'norbit_refresh';

export function refreshDoCookie(requisicao: Request): string | undefined {
  const cookies: unknown = requisicao.cookies;
  if (typeof cookies !== 'object' || cookies === null) {
    return undefined;
  }

  const valor = (cookies as Record<string, unknown>)[COOKIE_DE_REFRESH];
  return typeof valor === 'string' ? valor : undefined;
}

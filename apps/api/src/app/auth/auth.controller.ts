/**
 * As rotas de autenticação.
 *
 * O access token volta no corpo, para o cliente guardar em memória. O refresh
 * volta num cookie `httpOnly`, que o JavaScript da página não consegue ler —
 * então um XSS não leva a sessão de 30 dias embora. É a razão de os dois
 * tokens viajarem por caminhos diferentes.
 */
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  cadastroSchema,
  loginSchema,
  type Cadastro,
  type Login,
  type UsuarioAutenticado,
} from '@norbit/contracts';
import type { CookieOptions, Request, Response } from 'express';
import { ZodValidationPipe } from '../comum/zod-validation.pipe';
import { AuthGuard } from './auth.guard';
import {
  AuthService,
  type Autenticacao,
  type ContextoDaSessao,
} from './auth.service';
import { UsuarioAtual } from './usuario-atual.decorator';
import type { Requisitante } from './auth.guard';

const COOKIE_DE_REFRESH = 'norbit_refresh';

/**
 * O caminho restringe onde o cookie é enviado: ele não acompanha toda
 * requisição à API, só as de autenticação. Menos exposição, de graça.
 */
const CAMINHO_DO_COOKIE = '/api/auth';

type RespostaDeSessao = {
  readonly accessToken: string;
  readonly usuario: UsuarioAutenticado;
};

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('cadastro')
  @UsePipes(new ZodValidationPipe(cadastroSchema))
  async cadastrar(
    @Body() dados: Cadastro,
    @Req() requisicao: Request,
    @Res({ passthrough: true }) resposta: Response,
  ): Promise<RespostaDeSessao> {
    const autenticacao = await this.auth.cadastrar(
      dados,
      contextoDa(requisicao),
    );
    return this.responder(autenticacao, resposta);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(loginSchema))
  async entrar(
    @Body() dados: Login,
    @Req() requisicao: Request,
    @Res({ passthrough: true }) resposta: Response,
  ): Promise<RespostaDeSessao> {
    const autenticacao = await this.auth.entrar(dados, contextoDa(requisicao));
    return this.responder(autenticacao, resposta);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async renovar(
    @Req() requisicao: Request,
    @Res({ passthrough: true }) resposta: Response,
  ): Promise<RespostaDeSessao> {
    const refresh = refreshDoCookie(requisicao);
    if (!refresh) {
      throw new UnauthorizedException('Sem sessão para renovar.');
    }

    const autenticacao = await this.auth.renovar(
      refresh,
      contextoDa(requisicao),
    );
    return this.responder(autenticacao, resposta);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async sair(
    @Req() requisicao: Request,
    @Res({ passthrough: true }) resposta: Response,
  ): Promise<void> {
    await this.auth.sair(refreshDoCookie(requisicao));

    // Limpar o cookie precisa das mesmas opções com que ele foi criado, ou o
    // navegador não encontra qual apagar e a sessão "volta" no próximo refresh.
    resposta.clearCookie(COOKIE_DE_REFRESH, this.opcoesDoCookie());
  }

  @Get('eu')
  @UseGuards(AuthGuard)
  async eu(
    @UsuarioAtual() requisitante: Requisitante,
  ): Promise<UsuarioAutenticado> {
    const usuario = await this.auth.usuarioPorId(requisitante.id);

    // O access token é válido por 15 minutos e não consulta o banco: a conta
    // pode ter sido apagada nesse intervalo.
    if (!usuario) {
      throw new UnauthorizedException('Conta não encontrada.');
    }

    return usuario;
  }

  private responder(
    autenticacao: Autenticacao,
    resposta: Response,
  ): RespostaDeSessao {
    resposta.cookie(COOKIE_DE_REFRESH, autenticacao.refreshToken, {
      ...this.opcoesDoCookie(),
      expires: autenticacao.expiraEm,
    });

    return {
      accessToken: autenticacao.accessToken,
      usuario: autenticacao.usuario,
    };
  }

  private opcoesDoCookie(): CookieOptions {
    return {
      httpOnly: true,
      // `strict` basta: web e api ficam no mesmo site (porta não conta para o
      // SameSite, e em produção serão subdomínios do mesmo domínio). Se um dia
      // a API mudar de domínio, isto vira `none` com `secure` obrigatório.
      sameSite: 'strict',
      secure: this.config.get<string>('NODE_ENV') === 'production',
      path: CAMINHO_DO_COOKIE,
    };
  }
}

function refreshDoCookie(requisicao: Request): string | undefined {
  const cookies: unknown = requisicao.cookies;
  if (typeof cookies !== 'object' || cookies === null) {
    return undefined;
  }

  const valor = (cookies as Record<string, unknown>)[COOKIE_DE_REFRESH];
  return typeof valor === 'string' ? valor : undefined;
}

function contextoDa(requisicao: Request): ContextoDaSessao {
  return {
    userAgent: requisicao.headers['user-agent'] ?? null,
    ipAddress: requisicao.ip ?? null,
  };
}

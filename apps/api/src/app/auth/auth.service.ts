/**
 * Cadastro, login, renovação e saída.
 *
 * A decisão de segurança da renovação não está aqui: está em `avaliarRotacao`,
 * em `libs/domain`, como função pura e testada caso a caso. Este serviço só
 * persiste a consequência dela.
 */
import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { avaliarRotacao } from '@norbit/domain';
import { PrismaService, type User } from '@norbit/db';
import type { Cadastro, Login, UsuarioAutenticado } from '@norbit/contracts';
import { uuidv7 } from 'uuidv7';
import { SenhasService } from './senhas.service';
import { TokensService } from './tokens.service';

/** De onde veio a requisição, para a pessoa reconhecer sessões na lista. */
export type ContextoDaSessao = {
  readonly userAgent: string | null;
  readonly ipAddress: string | null;
};

export type ParDeTokens = {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiraEm: Date;
};

export type Autenticacao = ParDeTokens & {
  readonly usuario: UsuarioAutenticado;
};

/**
 * Mensagem única para e-mail inexistente e senha errada.
 *
 * Distinguir as duas diria a quem está tentando se aquele e-mail tem conta no
 * Norbit — informação que não custa nada obter e que não deveria estar
 * disponível.
 */
const CREDENCIAL_INVALIDA = 'E-mail ou senha incorretos.';

const SESSAO_INVALIDA = 'Sessão inválida. Entre novamente.';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly senhas: SenhasService,
    private readonly tokens: TokensService,
  ) {}

  async cadastrar(
    dados: Cadastro,
    contexto: ContextoDaSessao,
  ): Promise<Autenticacao> {
    const passwordHash = await this.senhas.gerarHash(dados.password);
    const usuario = await this.criarUsuario(dados, passwordHash);
    const par = await this.abrirSessao(usuario, uuidv7(), contexto);

    return { ...par, usuario: paraUsuarioAutenticado(usuario) };
  }

  async entrar(
    dados: Login,
    contexto: ContextoDaSessao,
  ): Promise<Autenticacao> {
    const usuario = await this.prisma.user.findFirst({
      where: { email: dados.email, deletedAt: null },
    });

    // Conta criada só por OAuth não tem senha: `passwordHash` nulo não pode
    // virar "senha vazia confere".
    if (!usuario?.passwordHash) {
      await this.senhas.verificarEmTempoConstante(dados.password);
      throw new UnauthorizedException(CREDENCIAL_INVALIDA);
    }

    const confere = await this.senhas.conferir(
      usuario.passwordHash,
      dados.password,
    );
    if (!confere) {
      throw new UnauthorizedException(CREDENCIAL_INVALIDA);
    }

    const par = await this.abrirSessao(usuario, uuidv7(), contexto);
    return { ...par, usuario: paraUsuarioAutenticado(usuario) };
  }

  /**
   * Troca um refresh por um par novo, de uso único.
   *
   * Reúso detectado derruba a família inteira: não há como saber se o legítimo
   * é quem acabou de chegar ou quem rotacionou antes, então os dois perdem a
   * sessão e a pessoa entra de novo. Falso positivo custa um login; falso
   * negativo custa a conta.
   */
  async renovar(
    refreshToken: string,
    contexto: ContextoDaSessao,
  ): Promise<Autenticacao> {
    const sessao = await this.prisma.session.findUnique({
      where: { refreshTokenHash: this.tokens.hashDeRefresh(refreshToken) },
    });

    const decisao = avaliarRotacao(sessao, new Date());

    if (decisao.tipo === 'reuso-detectado' && sessao) {
      await this.revogarFamilia(sessao.familyId);
      this.logger.warn(
        `Reúso de refresh token detectado; família ${sessao.familyId} revogada`,
      );
    }

    if (decisao.tipo !== 'rotacionar' || !sessao) {
      throw new UnauthorizedException(SESSAO_INVALIDA);
    }

    const usuario = await this.prisma.user.findFirst({
      where: { id: sessao.userId, deletedAt: null },
    });
    if (!usuario) {
      throw new UnauthorizedException(SESSAO_INVALIDA);
    }

    const par = await this.rotacionar(sessao, usuario, contexto);
    return { ...par, usuario: paraUsuarioAutenticado(usuario) };
  }

  /**
   * Sai da sessão, revogando a família.
   *
   * Revogar só o token atual deixaria vivo qualquer outro já rotacionado a
   * partir do mesmo login. Revogar a família também torna a detecção de reúso
   * idempotente: um token antigo reaparecendo depois da saída encontra a
   * família já revogada, e revogá-la de novo é inócuo.
   */
  async sair(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) {
      return;
    }

    const sessao = await this.prisma.session.findUnique({
      where: { refreshTokenHash: this.tokens.hashDeRefresh(refreshToken) },
      select: { familyId: true },
    });

    if (sessao) {
      await this.revogarFamilia(sessao.familyId);
    }
  }

  async usuarioPorId(id: string): Promise<UsuarioAutenticado | null> {
    const usuario = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
    return usuario ? paraUsuarioAutenticado(usuario) : null;
  }

  // ─── privados ──────────────────────────────────────────────────────────────

  private async criarUsuario(
    dados: Cadastro,
    passwordHash: string,
  ): Promise<User> {
    try {
      // `settings` aninhado: o Prisma resolve as duas inserções na mesma
      // transação, então não existe usuário sem preferências.
      return await this.prisma.user.create({
        data: {
          id: uuidv7(),
          email: dados.email,
          handle: dados.handle,
          displayName: dados.displayName,
          passwordHash,
          settings: { create: {} },
        },
      });
    } catch (erro) {
      throw conflitoDeCadastro(erro);
    }
  }

  private async abrirSessao(
    usuario: User,
    familyId: string,
    contexto: ContextoDaSessao,
  ): Promise<ParDeTokens> {
    const refresh = this.tokens.gerarRefreshToken();
    const expiraEm = this.tokens.expiracaoDoRefresh(new Date());

    await this.prisma.session.create({
      data: {
        id: uuidv7(),
        userId: usuario.id,
        refreshTokenHash: refresh.hash,
        familyId,
        userAgent: contexto.userAgent,
        ipAddress: contexto.ipAddress,
        expiresAt: expiraEm,
      },
    });

    return {
      accessToken: await this.tokens.gerarAccessToken(usuario),
      refreshToken: refresh.valor,
      expiraEm,
    };
  }

  /**
   * Revoga o token apresentado e abre o próximo na mesma família, numa única
   * transação: se a criação falhar, a revogação não fica aplicada e a pessoa
   * não perde a sessão por causa de um erro de escrita.
   */
  private async rotacionar(
    sessao: { id: string; familyId: string },
    usuario: User,
    contexto: ContextoDaSessao,
  ): Promise<ParDeTokens> {
    const refresh = this.tokens.gerarRefreshToken();
    const expiraEm = this.tokens.expiracaoDoRefresh(new Date());

    await this.prisma.$transaction([
      this.prisma.session.update({
        where: { id: sessao.id },
        data: { revokedAt: new Date() },
      }),
      this.prisma.session.create({
        data: {
          id: uuidv7(),
          userId: usuario.id,
          refreshTokenHash: refresh.hash,
          familyId: sessao.familyId,
          userAgent: contexto.userAgent,
          ipAddress: contexto.ipAddress,
          expiresAt: expiraEm,
        },
      }),
    ]);

    return {
      accessToken: await this.tokens.gerarAccessToken(usuario),
      refreshToken: refresh.valor,
      expiraEm,
    };
  }

  private async revogarFamilia(familyId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}

function paraUsuarioAutenticado(usuario: User): UsuarioAutenticado {
  return {
    id: usuario.id,
    email: usuario.email,
    handle: usuario.handle,
    displayName: usuario.displayName,
    avatarUrl: usuario.avatarUrl,
    timeZone: usuario.timeZone,
  };
}

/**
 * Traduz a violação de unicidade do Postgres para uma mensagem útil.
 *
 * Dizer "e-mail já cadastrado" sem saber qual campo conflitou faria a pessoa
 * trocar o e-mail quando o problema era o handle.
 */
function conflitoDeCadastro(erro: unknown): Error {
  const alvo = alvoDoConflito(erro);

  if (alvo?.includes('email')) {
    return new ConflictException('Já existe uma conta com esse e-mail.');
  }
  if (alvo?.includes('handle')) {
    return new ConflictException('Esse handle já está em uso.');
  }
  return erro instanceof Error ? erro : new Error('Falha ao criar a conta.');
}

/**
 * Onde o campo em conflito aparece depende de como o Prisma está conectado, e
 * a documentação descreve apenas o caso sem driver adapter.
 *
 * Sem adapter, o P2002 traz `meta.target` com a lista de campos. Com o
 * `@prisma/adapter-pg` — que o Prisma 7 exige para conexão direta — o erro do
 * driver é embrulhado e o nome da constraint do Postgres desce três níveis:
 *
 * ```
 * meta.driverAdapterError.cause.constraint.index === 'users_email_key'
 * ```
 *
 * Verificado contra o banco, não deduzido: o formato acima foi lido de um
 * P2002 real. Por isso a busca varre as duas formas e ainda cai na mensagem
 * original — se a estrutura mudar numa versão futura, a mensagem continua
 * dizendo qual campo conflitou em vez de virar erro 500.
 */
function alvoDoConflito(erro: unknown): string | null {
  if (
    typeof erro !== 'object' ||
    erro === null ||
    !('code' in erro) ||
    erro.code !== 'P2002' ||
    !('meta' in erro)
  ) {
    return null;
  }

  const meta = erro.meta;
  const candidatos = [
    ['target'],
    ['constraint'],
    ['driverAdapterError', 'cause', 'constraint', 'index'],
    ['driverAdapterError', 'cause', 'constraint', 'fields'],
    ['driverAdapterError', 'cause', 'originalMessage'],
  ] as const;

  for (const caminho of candidatos) {
    const texto = comoTexto(valorEm(meta, caminho));
    if (texto !== null) {
      return texto;
    }
  }

  return null;
}

/** Caminha por um objeto desconhecido sem assumir que algum nível existe. */
function valorEm(raiz: unknown, caminho: readonly string[]): unknown {
  let atual = raiz;

  for (const chave of caminho) {
    if (typeof atual !== 'object' || atual === null || !(chave in atual)) {
      return undefined;
    }
    atual = (atual as Record<string, unknown>)[chave];
  }

  return atual;
}

function comoTexto(valor: unknown): string | null {
  if (Array.isArray(valor)) {
    return valor.map(String).join(',');
  }
  return typeof valor === 'string' ? valor : null;
}

/**
 * Emissão dos dois tokens, que são deliberadamente de naturezas diferentes.
 *
 * **Access token**: JWT curto (15 min), verificável sem consultar o banco. É o
 * que torna cada requisição barata. O preço é não ser revogável: uma vez
 * emitido, vale até expirar — daí o prazo curto.
 *
 * **Refresh token**: string opaca e aleatória, longa (30 dias), guardada no
 * banco como hash. É revogável a qualquer momento, porque cada uso passa por
 * uma consulta. Não é JWT de propósito: um JWT de 30 dias que não dá para
 * revogar é exatamente o que não se quer na mão de quem roubou o cookie.
 */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';

/** 256 bits de entropia: adivinhar não é um caminho viável. */
const BYTES_DE_REFRESH = 32;

export type ConteudoDoAccessToken = {
  readonly sub: string;
  readonly handle: string;
};

export type RefreshEmitido = {
  /** Vai para o cookie, e só para o cookie. */
  readonly valor: string;
  /** Vai para o banco, e só para o banco. */
  readonly hash: string;
};

@Injectable()
export class TokensService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async gerarAccessToken(usuario: {
    id: string;
    handle: string;
  }): Promise<string> {
    return this.jwt.signAsync({ sub: usuario.id, handle: usuario.handle });
  }

  async lerAccessToken(token: string): Promise<ConteudoDoAccessToken> {
    return this.jwt.verifyAsync<ConteudoDoAccessToken>(token);
  }

  gerarRefreshToken(): RefreshEmitido {
    const valor = randomBytes(BYTES_DE_REFRESH).toString('base64url');
    return { valor, hash: this.hashDeRefresh(valor) };
  }

  /**
   * SHA-256, e **não** Argon2id, por duas razões.
   *
   * A primeira é que a busca da sessão é feita *pelo* hash: ele precisa ser
   * determinístico, e Argon2 usa salt aleatório, o que obrigaria a varrer
   * todas as sessões do banco a cada renovação.
   *
   * A segunda é que Argon2 existe para compensar a baixa entropia de senhas
   * humanas. Um valor de 256 bits aleatórios não tem esse problema: não há
   * dicionário que o alcance, e o custo de memória seria desperdício de CPU em
   * cada renovação.
   */
  hashDeRefresh(valor: string): string {
    return createHash('sha256').update(valor).digest('hex');
  }

  /** Quando o refresh emitido agora deixa de valer. */
  expiracaoDoRefresh(agora: Date): Date {
    const dias = Number(
      this.config.get<string>('REFRESH_TOKEN_TTL_DAYS', '30'),
    );
    return new Date(agora.getTime() + dias * 24 * 60 * 60 * 1000);
  }
}

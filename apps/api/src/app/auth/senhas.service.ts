/**
 * Hash e verificação de senha.
 *
 * Argon2id, com os parâmetros mínimos que a OWASP recomenda: 19 MiB de
 * memória, 2 iterações, paralelismo 1. O custo de memória é o que torna o
 * ataque com GPU caro — é por isso que Argon2id venceu a competição de hashing
 * de senha, e por isso que bcrypt, de memória fixa e pequena, não é mais a
 * escolha certa para código novo.
 */
import { Injectable, OnModuleInit } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { Algorithm, hash, verify } from '@node-rs/argon2';

const PARAMETROS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

@Injectable()
export class SenhasService implements OnModuleInit {
  /**
   * Hash de uma senha aleatória, calculado uma vez na subida.
   *
   * Precisa ser um hash **válido**: um valor inventado faria o `verify` lançar
   * de imediato, a verificação custaria quase nada, e o oráculo de tempo que
   * `verificarEmTempoConstante` existe para fechar continuaria aberto.
   */
  private hashDeFachada = '';

  async onModuleInit(): Promise<void> {
    this.hashDeFachada = await this.gerarHash(
      randomBytes(32).toString('base64url'),
    );
  }

  async gerarHash(senha: string): Promise<string> {
    return hash(senha, PARAMETROS);
  }

  async conferir(hashArmazenado: string, senha: string): Promise<boolean> {
    try {
      return await verify(hashArmazenado, senha, PARAMETROS);
    } catch {
      // Hash corrompido ou em formato desconhecido: não é senha correta, e não
      // é motivo para derrubar a requisição com erro 500.
      return false;
    }
  }

  /**
   * Gasta o tempo de uma verificação real mesmo sem ter hash para conferir.
   *
   * Sem isto, o login responde visivelmente mais rápido quando o e-mail não
   * existe, e essa diferença é um oráculo: dá para enumerar quais e-mails têm
   * conta sem nunca acertar uma senha.
   */
  async verificarEmTempoConstante(senha: string): Promise<false> {
    await this.conferir(this.hashDeFachada, senha);
    return false;
  }
}

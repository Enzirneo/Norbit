/**
 * O armazenamento dos contadores do limite de frequência.
 *
 * Em memória, de propósito: o Norbit roda numa instância só, e um Map é o que
 * basta. Com mais de uma instância, cada uma contaria por si e o limite efetivo
 * seria multiplicado — o dia em que isso for verdade, o armazenamento vira o
 * Redis que já está no `docker-compose`, e só esta classe muda.
 *
 * A decisão (permitir ou bloquear) é de `avaliarLimite`, em `libs/domain`.
 */
import { Injectable } from '@nestjs/common';
import {
  avaliarLimite,
  type RegraDeLimite,
  type VereditoDeLimite,
} from '@norbit/domain';

type Entrada = {
  readonly registros: readonly number[];
  readonly janelaMs: number;
};

/**
 * O teto de chaves guardadas.
 *
 * Quem varre e-mails inventados cria uma chave por tentativa. Sem teto, o
 * mecanismo que protege o servidor vira a forma de derrubá-lo por memória.
 */
const TETO_DE_CHAVES = 10_000;

@Injectable()
export class LimiteService {
  readonly teto = TETO_DE_CHAVES;

  private readonly entradas = new Map<string, Entrada>();

  get tamanho(): number {
    return this.entradas.size;
  }

  tentar(
    chave: string,
    regra: RegraDeLimite,
    agora: number = Date.now(),
  ): VereditoDeLimite {
    const veredito = avaliarLimite(
      this.entradas.get(chave)?.registros ?? [],
      agora,
      regra,
    );

    if (veredito.permitido) {
      // Apagar antes de gravar move a chave para o fim do Map: a ordem de
      // inserção passa a ser a do último uso, e é ela que decide quem sai
      // primeiro quando o teto estoura.
      this.entradas.delete(chave);
      this.entradas.set(chave, {
        registros: veredito.registros,
        janelaMs: regra.janelaMs,
      });
      this.garantirTeto(agora);
    }

    return veredito;
  }

  /** Descarta as chaves cuja tentativa mais recente já saiu da janela. */
  limparExpiradas(agora: number = Date.now()): void {
    for (const [chave, entrada] of this.entradas) {
      const ultima = entrada.registros[entrada.registros.length - 1] ?? 0;
      if (agora - ultima >= entrada.janelaMs) {
        this.entradas.delete(chave);
      }
    }
  }

  private garantirTeto(agora: number): void {
    if (this.entradas.size <= TETO_DE_CHAVES) {
      return;
    }

    this.limparExpiradas(agora);

    // Ainda acima: sai quem ficou mais tempo sem uso. Sob ataque isso pode
    // esquecer um contador legítimo, e é a troca certa — a alternativa é
    // crescer sem limite.
    for (const chave of this.entradas.keys()) {
      if (this.entradas.size <= TETO_DE_CHAVES) {
        break;
      }
      this.entradas.delete(chave);
    }
  }
}

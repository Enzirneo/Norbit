/**
 * O período que vai para o banco.
 *
 * Um evento com hora é gravado como chegou; um de dia inteiro é normalizado
 * para meia-noite a meia-noite **no fuso do evento**, com o fim exclusivo (ver
 * `libs/domain/src/lib/agendas/dia-inteiro.ts`).
 *
 * A normalização acontece aqui, na escrita, e não na leitura: duas telas lendo a
 * mesma linha chegariam ao mesmo resultado de qualquer forma, mas uma consulta
 * por intervalo precisa que o que está gravado já seja a forma canônica — do
 * contrário o filtro do Postgres compararia uma coisa e a expansão outra.
 */
import { normalizarDiaInteiro } from '@norbit/domain';

export type Periodo = {
  readonly inicio: Date;
  readonly fim: Date;
};

export function intervaloGravado(entrada: {
  readonly inicio: Date;
  readonly fim: Date;
  readonly diaInteiro: boolean;
  readonly fuso: string;
}): Periodo {
  if (!entrada.diaInteiro) {
    return { inicio: entrada.inicio, fim: entrada.fim };
  }

  return normalizarDiaInteiro({
    inicio: entrada.inicio,
    fim: entrada.fim,
    fuso: entrada.fuso,
  });
}

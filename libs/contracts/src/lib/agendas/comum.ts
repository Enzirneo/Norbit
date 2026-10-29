/**
 * Validadores compartilhados pelos contratos de agenda e de evento.
 *
 * Vivem aqui, e não duplicados nos dois arquivos, porque "o que é uma cor
 * válida" é uma regra do produto — e uma regra com duas cópias tem duas
 * versões na primeira alteração.
 */
import { z } from 'zod';

/**
 * Cor em hexadecimal de seis dígitos, sempre minúscula.
 *
 * Três dígitos (`#f0a`) são recusados em vez de expandidos: a cor é comparada
 * como texto no banco e usada como chave de tema, então duas grafias da mesma
 * cor viram duas cores. Normalizar para minúscula resolve metade do problema; a
 * outra metade é só aceitar uma forma.
 */
export const corHex = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^#[0-9a-f]{6}$/,
    'A cor precisa estar em hexadecimal de seis dígitos, como #6d7cff.',
  );

/**
 * Fuso horário IANA, validado **e canonizado** contra a base do próprio runtime.
 *
 * Uma lista fixa de fusos ficaria desatualizada na próxima vez que algum país
 * mudar de regra. O `Intl` carrega a base tzdata e é quem sabe a resposta.
 * `Intl.supportedValuesOf('timeZone')` não serve como lista branca: ele deixa
 * de fora o `UTC` e todos os apelidos históricos, como `US/Pacific`.
 *
 * Isto importa mais do que parece: o fuso de um evento é o que torna a expansão
 * de recorrência correta (ver `libs/domain/src/lib/tempo/zona.ts`), e um fuso
 * inválido gravado no banco transforma toda consulta daquela série num erro em
 * runtime, longe da requisição que o causou.
 *
 * Duas descobertas, as duas medidas no runtime e não deduzidas:
 *
 * 1. **O `Intl` aceita deslocamento fixo.** `timeZone: '-03:00'` não lança —
 *    a ES2024 passou a permitir essa forma. Aceitá-la destruiria em silêncio a
 *    razão de o campo existir: `-03:00` é um número, não um lugar, e não sabe
 *    quando o horário de verão começa. Um evento semanal gravado assim
 *    deslizaria uma hora na virada. Por isso o deslocamento é recusado.
 * 2. **O `Intl` normaliza.** `us/pacific` e `America/Los_Angeles` são o mesmo
 *    fuso para ele, e `america/sao_paulo` resolve para a grafia correta. Então
 *    o valor guardado é o canônico, e não o que chegou: o fuso é comparado e
 *    agrupado como texto, e duas grafias do mesmo lugar viram dois fusos.
 */
export const fusoIana = z
  .string()
  .trim()
  .min(1, 'Informe o fuso horário.')
  .transform((valor, ctx) => {
    const canonico = canonizarFuso(valor);

    if (canonico === null) {
      ctx.addIssue({
        code: 'custom',
        message:
          'Fuso horário desconhecido. Use um nome IANA, como America/Sao_Paulo.',
      });
      return z.NEVER;
    }

    if (ehDeslocamento(canonico)) {
      ctx.addIssue({
        code: 'custom',
        message:
          'Informe o fuso pelo nome do lugar, como America/Sao_Paulo. Um deslocamento fixo não sabe quando o horário de verão começa.',
      });
      return z.NEVER;
    }

    return canonico;
  });

function canonizarFuso(valor: string): string | null {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: valor,
    }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
}

function ehDeslocamento(canonico: string): boolean {
  return /^[+-]/.test(canonico);
}

/**
 * Instante vindo do JSON, convertido para `Date`.
 *
 * Exige deslocamento explícito (`Z` ou `+03:00`). Uma data sem deslocamento é
 * ambígua, e o servidor interpretaria no fuso **dele** — o que faz o evento
 * aparecer na hora errada quando o servidor roda em UTC e a pessoa não.
 */
export const instante = z.iso
  .datetime({ offset: true })
  .transform((texto) => new Date(texto));

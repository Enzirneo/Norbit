/**
 * Os campos de data e hora de um formulário.
 *
 * `<input type="date">` e `<input type="time">` devolvem **texto de parede** —
 * "2026-06-15" e "09:00" — sem fuso nenhum. Virar instante exige saber em que
 * fuso aquelas 9h acontecem, e é aqui que nasce o defeito "marquei 9h e salvou
 * 6h": usar o fuso do navegador quando o evento é de outro.
 *
 * Fica em `libs/domain` porque é conversão de tempo, e porque a ida e a volta
 * precisam fechar: o formulário de edição lê o instante, mostra o texto, e o
 * texto volta a virar o mesmo instante se ninguém mexeu.
 */
import { paraHoraLocal, paraInstante } from '../tempo/zona';

export type CamposDeTempo = {
  /** `AAAA-MM-DD`, como o `<input type="date">` entrega. */
  readonly data: string;
  /** `HH:MM`. Ausente é dia inteiro. */
  readonly hora?: string;
};

const DATA = /^(\d{4})-(\d{2})-(\d{2})$/;
const HORA = /^(\d{2}):(\d{2})$/;

export function deCamposParaInstante(
  campos: CamposDeTempo,
  fuso: string,
): Date {
  const { ano, mes, dia } = lerData(campos.data);
  const { hora, minuto } = lerHora(campos.hora);

  // A política da hora inexistente é a de `paraInstante`: empurrar para frente.
  // Recusar faria o formulário rejeitar um horário que a pessoa tem todo o
  // direito de querer, com uma explicação que não cabe num campo.
  return paraInstante({ ano, mes, dia, hora, minuto }, fuso);
}

export function deInstanteParaCampos(
  instante: Date,
  fuso: string,
): CamposDeTempo {
  const local = paraHoraLocal(instante, fuso);

  return {
    data: `${local.ano}-${dois(local.mes)}-${dois(local.dia)}`,
    // Zerado à esquerda porque o `<input type="time">` recusa "9:5" em silêncio
    // e fica vazio — o campo apareceria em branco num evento que tem horário.
    hora: `${dois(local.hora)}:${dois(local.minuto)}`,
  };
}

function dois(valor: number): string {
  return String(valor).padStart(2, '0');
}

/**
 * Lê a data, exigindo que ela exista no calendário.
 *
 * A expressão regular aceita `2026-02-31`, e `Date.UTC` o aceitaria também —
 * virando 3 de março em silêncio. O formulário do navegador nunca produz isso,
 * mas um POST produz, e um evento gravado num dia que ninguém escolheu é pior
 * que uma recusa.
 */
function lerData(texto: string): { ano: number; mes: number; dia: number } {
  const encontrado = DATA.exec(texto);
  if (!encontrado) {
    throw new Error(`Data inválida: "${texto}". Use o formato AAAA-MM-DD.`);
  }

  const [, a, m, d] = encontrado.map(Number) as [
    number,
    number,
    number,
    number,
  ];
  const comoUtc = new Date(Date.UTC(a, m - 1, d));

  const existe =
    comoUtc.getUTCFullYear() === a &&
    comoUtc.getUTCMonth() === m - 1 &&
    comoUtc.getUTCDate() === d;

  if (!existe) {
    throw new Error(`Data inválida: "${texto}" não existe no calendário.`);
  }

  return { ano: a, mes: m, dia: d };
}

function lerHora(texto: string | undefined): { hora: number; minuto: number } {
  // Sem hora é dia inteiro, e a meia-noite local é a forma que o servidor
  // espera para normalizar (ver docs/09).
  if (texto === undefined || texto === '') {
    return { hora: 0, minuto: 0 };
  }

  const encontrado = HORA.exec(texto);
  const hora = Number(encontrado?.[1]);
  const minuto = Number(encontrado?.[2]);

  if (!encontrado || hora > 23 || minuto > 59) {
    throw new Error(`Hora inválida: "${texto}". Use o formato HH:MM.`);
  }

  return { hora, minuto };
}

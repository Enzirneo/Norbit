/**
 * Traduz erros de validação para um mapa campo → mensagem.
 *
 * Duas fontes acabam no mesmo formato: o Zod, que roda no navegador antes de
 * enviar, e a API, que roda o **mesmo** schema e pode recusar coisas que só o
 * servidor sabe (e-mail já cadastrado, handle em uso). A tela não precisa
 * distinguir de onde veio o erro — só onde mostrá-lo.
 */
import { HttpErrorResponse } from '@angular/common/http';
import type { ZodError } from 'zod';

export type ErrosPorCampo = Record<string, string>;

export function errosDoZod(erro: ZodError): ErrosPorCampo {
  const mapa: ErrosPorCampo = {};

  for (const problema of erro.issues) {
    const campo = problema.path.join('.') || 'formulario';
    // O primeiro problema de cada campo basta: mostrar três mensagens para o
    // mesmo input só confunde.
    mapa[campo] ??= problema.message;
  }

  return mapa;
}

export function errosDaApi(erro: unknown): ErrosPorCampo {
  if (!(erro instanceof HttpErrorResponse)) {
    return { formulario: 'Não foi possível concluir. Tente de novo.' };
  }

  const campos = camposDoCorpo(erro.error);
  if (campos) {
    return campos;
  }

  // Conflito (e-mail ou handle em uso) e credencial inválida chegam como
  // mensagem única, sem indicar campo.
  const mensagem = mensagemDoCorpo(erro.error);
  if (mensagem) {
    return { formulario: mensagem };
  }

  if (erro.status === 0) {
    return { formulario: 'Sem conexão com o servidor.' };
  }

  return { formulario: 'Não foi possível concluir. Tente de novo.' };
}

/** O formato que o `ZodValidationPipe` da API devolve num 400. */
function camposDoCorpo(corpo: unknown): ErrosPorCampo | null {
  if (typeof corpo !== 'object' || corpo === null || !('campos' in corpo)) {
    return null;
  }

  const lista = (corpo as { campos: unknown }).campos;
  if (!Array.isArray(lista)) {
    return null;
  }

  const mapa: ErrosPorCampo = {};
  for (const item of lista) {
    const problema = comoProblemaDeCampo(item);
    if (problema) {
      mapa[problema.campo] ??= problema.mensagem;
    }
  }

  return Object.keys(mapa).length > 0 ? mapa : null;
}

/**
 * O corpo vem da rede, então nada nele é garantido.
 *
 * Extraída de `camposDoCorpo` porque as verificações de tipo aninhadas
 * estouraram o limite de complexidade do ESLint — e o limite tinha razão: duas
 * responsabilidades num laço só.
 */
function comoProblemaDeCampo(
  item: unknown,
): { campo: string; mensagem: string } | null {
  if (
    typeof item !== 'object' ||
    item === null ||
    !('campo' in item) ||
    !('mensagem' in item)
  ) {
    return null;
  }

  const { campo, mensagem } = item as { campo: unknown; mensagem: unknown };

  return typeof campo === 'string' && typeof mensagem === 'string'
    ? { campo, mensagem }
    : null;
}

function mensagemDoCorpo(corpo: unknown): string | null {
  if (typeof corpo !== 'object' || corpo === null || !('message' in corpo)) {
    return null;
  }

  const { message } = corpo as { message: unknown };
  return typeof message === 'string' ? message : null;
}

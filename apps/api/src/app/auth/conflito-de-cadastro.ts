/**
 * Conflito de unicidade da conta (e-mail ou handle), traduzido para mensagem.
 *
 * Mora fora do `AuthService` porque o cadastro e a edição do perfil esbarram
 * nas mesmas duas constraints.
 */
import { ConflictException } from '@nestjs/common';

export /**
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

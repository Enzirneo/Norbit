/**
 * Contratos de entrada da autenticação.
 *
 * Os schemas vivem aqui, e não no back-end, para que o formulário do Angular
 * valide com exatamente a mesma regra que a API aplica — sem duas cópias que
 * divergem na primeira alteração.
 */
import { z } from 'zod';

/**
 * Doze caracteres, e nenhuma exigência de composição.
 *
 * Regra de composição ("uma maiúscula, um número, um símbolo") produz
 * `Senha@123`: curta, previsível, e aprovada. Comprimento é o único critério
 * que correlaciona com dificuldade real de quebra, e é o que o NIST recomenda
 * desde a SP 800-63B.
 */
const TAMANHO_MINIMO_DE_SENHA = 12;

const senhaNova = z
  .string()
  .min(
    TAMANHO_MINIMO_DE_SENHA,
    `A senha precisa de pelo menos ${TAMANHO_MINIMO_DE_SENHA} caracteres. Uma frase curta serve.`,
  )
  // Limite superior porque o Argon2id gasta CPU proporcional à entrada: sem
  // teto, um corpo de 1 MB vira negação de serviço barata.
  .max(200, 'A senha é longa demais.');

// `.pipe()` em vez de `.email()` direto no string: o `.email()` encadeado está
// deprecado no Zod 4. A ordem importa — normaliza, depois valida.
const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('E-mail inválido.').max(254, 'E-mail longo demais.'));

/**
 * O handle aparece em URL (`/@enzo`), então o alfabeto é restrito de propósito:
 * ponto e espaço quebrariam a rota, e maiúsculas criariam dois caminhos para a
 * mesma pessoa.
 */
const handle = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'O handle precisa de pelo menos 3 caracteres.')
  .max(20, 'O handle pode ter no máximo 20 caracteres.')
  .regex(
    /^[a-z0-9_]+$/,
    'O handle aceita apenas letras, números e sublinhado.',
  );

export const cadastroSchema = z
  .object({
    email,
    handle,
    displayName: z
      .string()
      .trim()
      .min(1, 'Diga como você quer ser chamado.')
      .max(80),
    password: senhaNova,
  })
  // `strip` é o padrão do Zod, mas explícito aqui porque é uma decisão de
  // segurança: campo não declarado é descartado, então um `role: "ADMIN"` no
  // corpo da requisição nunca chega ao service.
  .strip();

export const loginSchema = z
  .object({
    email,
    // Sem mínimo, de propósito: recusar no login por tamanho revelaria que
    // aquela senha não satisfaz a política, o que é informação de graça para
    // quem está tentando adivinhar.
    password: z.string().max(200),
  })
  .strip();

export type Cadastro = z.infer<typeof cadastroSchema>;
export type Login = z.infer<typeof loginSchema>;

/** O que a API devolve depois de um cadastro ou login bem-sucedido. */
export type SessaoCriada = {
  readonly accessToken: string;
  readonly usuario: UsuarioAutenticado;
};

export type UsuarioAutenticado = {
  readonly id: string;
  readonly email: string;
  readonly handle: string;
  readonly displayName: string;
  readonly avatarUrl: string | null;
  readonly timeZone: string;
};

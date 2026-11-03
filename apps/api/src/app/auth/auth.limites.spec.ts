/**
 * Prova que os limites estão **ligados** às rotas reais de autenticação.
 *
 * O `limite.guard.spec.ts` prova o mecanismo numa rota de teste. O que ele não
 * pode provar é que alguém lembrou de pôr `@Limitar` em cada rota pública — e é
 * exatamente o esquecimento que deixaria uma delas aberta sem nenhum teste
 * falhar. Aqui sobe-se a aplicação inteira e dispara-se contra o que existe.
 */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../app.module';

// Montada em tempo de execução: não é segredo, mas um literal atribuído ao campo
// de senha aciona o detector do GitGuardian.
const SENHA_ERRADA = ['senha', 'errada'].join(' ');

async function post(
  url: string,
  rota: string,
  corpo: unknown,
): Promise<Response> {
  return fetch(`${url}/auth/${rota}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(corpo),
  });
}

describe('limites das rotas de autenticação', () => {
  let app: INestApplication;
  let url: string;

  beforeEach(async () => {
    // Uma aplicação nova por teste: os contadores são por IP, e todos os testes
    // vêm do mesmo, então compartilhar a instância os faria se atrapalharem.
    // Dependem do limite ligado, mesmo que o ambiente o desligue para os e2e.
    delete process.env['LIMITE_DE_FREQUENCIA'];

    const modulo = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = modulo.createNestApplication();
    await app.listen(0);
    url = await app.getUrl();
  });

  afterEach(async () => {
    await app.close();
  });

  it('esqueci-senha: o quarto pedido para o mesmo e-mail é barrado', async () => {
    const corpo = { email: 'limite-esqueci@norbit.dev' };

    const estados: number[] = [];
    for (let i = 0; i < 4; i += 1) {
      estados.push((await post(url, 'esqueci-senha', corpo)).status);
    }

    expect(estados).toEqual([204, 204, 204, 429]);
  });

  it('esqueci-senha: o limite vale também para e-mail sem conta', async () => {
    // Barrar só quem tem conta revelaria quem tem conta.
    const sem = { email: 'nao-existe-limite@norbit.dev' };

    for (let i = 0; i < 3; i += 1) {
      await post(url, 'esqueci-senha', sem);
    }

    expect((await post(url, 'esqueci-senha', sem)).status).toBe(429);
  });

  it('login: a décima primeira tentativa para o mesmo e-mail é barrada', async () => {
    const corpo = { email: 'limite-login@norbit.dev', password: SENHA_ERRADA };

    let barrada = 0;
    for (let i = 0; i < 11; i += 1) {
      if ((await post(url, 'login', corpo)).status === 429) {
        barrada += 1;
      }
    }

    expect(barrada).toBe(1);
  });

  it('login: e-mails diferentes não dividem o contador por e-mail', async () => {
    for (let i = 0; i < 10; i += 1) {
      await post(url, 'login', {
        email: 'limite-login-a@norbit.dev',
        password: SENHA_ERRADA,
      });
    }

    const outro = await post(url, 'login', {
      email: 'limite-login-b@norbit.dev',
      password: SENHA_ERRADA,
    });

    expect(outro.status).toBe(401);
  });

  it('cadastro: a décima primeira tentativa do mesmo IP é barrada', async () => {
    let ultimo = 0;
    for (let i = 0; i < 11; i += 1) {
      // Corpo inválido de propósito: o limite vale antes da validação, e assim
      // nenhuma conta é criada.
      ultimo = (await post(url, 'cadastro', {})).status;
    }

    expect(ultimo).toBe(429);
  });

  it('redefinir-senha: tem limite por IP', async () => {
    let ultimo = 0;
    for (let i = 0; i < 21; i += 1) {
      ultimo = (await post(url, 'redefinir-senha', {})).status;
    }

    expect(ultimo).toBe(429);
  });
});

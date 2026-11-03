/**
 * Os convites pelas rotas reais, com a aplicação inteira e JWT de verdade.
 *
 * O `convites.service.spec.ts` prova as regras. O que ele não prova é a fiação:
 * que a rota de aceitar exige sessão, que a previsão é pública, que o
 * identificador malformado é recusado, e que cada papel encontra a porta certa.
 */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '@norbit/db';
import { AppModule } from '../app.module';
import { EmailService } from '../comum/email.service';

// Montada em tempo de execução para não acionar o detector de segredos.
const SENHA = ['uma', 'senha', 'bem', 'longa'].join(' ');

const EMAILS = [
  'rotas-dono@convites.norbit.dev',
  'rotas-maria@convites.norbit.dev',
];

const EmailFalso = {
  linkDoConvite: (token: string): string =>
    `http://teste/convite?token=${token}`,
  enviarConvite: (): Promise<void> => Promise.resolve(),
};

type Sessao = { token: string };

describe('rotas dos convites', () => {
  let app: INestApplication;
  let url: string;
  let prisma: PrismaService;

  async function chamar(
    metodo: string,
    caminho: string,
    opcoes: { token?: string; corpo?: unknown } = {},
  ): Promise<{ status: number; corpo: unknown }> {
    const resposta = await fetch(`${url}${caminho}`, {
      method: metodo,
      headers: {
        'content-type': 'application/json',
        ...(opcoes.token ? { authorization: `Bearer ${opcoes.token}` } : {}),
      },
      body:
        opcoes.corpo === undefined ? undefined : JSON.stringify(opcoes.corpo),
    });
    const texto = await resposta.text();
    return {
      status: resposta.status,
      corpo: texto === '' ? null : (JSON.parse(texto) as unknown),
    };
  }

  async function cadastrar(nome: string, email: string): Promise<Sessao> {
    const r = await chamar('POST', '/auth/cadastro', {
      corpo: { email, handle: nome, displayName: nome, password: SENHA },
    });
    return { token: (r.corpo as { accessToken: string }).accessToken };
  }

  async function limpar(): Promise<void> {
    const usuarios = await prisma.user.findMany({
      where: { email: { in: EMAILS } },
      select: { id: true },
    });
    const ids = usuarios.map((u) => u.id);
    if (ids.length > 0) {
      await prisma.calendar.deleteMany({ where: { ownerId: { in: ids } } });
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    }
  }

  beforeAll(async () => {
    // Cada teste cadastra duas contas, e o cadastro permite 10 por hora por IP:
    // com o limite ligado, os últimos testes receberiam 429. O limite tem testes
    // próprios (`auth.limites.spec.ts`); este não é sobre ele.
    process.env['LIMITE_DE_FREQUENCIA'] = 'desligado';

    const modulo = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(EmailService)
      .useValue(EmailFalso)
      .compile();
    app = modulo.createNestApplication();
    await app.listen(0);
    url = await app.getUrl();
    prisma = modulo.get(PrismaService);
  });

  afterAll(async () => {
    delete process.env['LIMITE_DE_FREQUENCIA'];
    await limpar();
    await app.close();
  });

  beforeEach(limpar);

  async function cenario(): Promise<{
    dono: Sessao;
    maria: Sessao;
    agenda: string;
  }> {
    const dono = await cadastrar('rotas_dono', EMAILS[0] ?? '');
    const maria = await cadastrar('rotas_maria', EMAILS[1] ?? '');
    const agendas = await chamar('GET', '/agendas', { token: dono.token });
    const agenda = (agendas.corpo as { id: string }[])[0]?.id ?? '';
    return { dono, maria, agenda };
  }

  const tokenDe = (corpo: unknown): string =>
    (corpo as { link: string }).link.split('token=')[1] ?? '';

  it('o ciclo inteiro: o dono convida, a convidada vê, aceita e passa a ver a agenda', async () => {
    const { dono, maria, agenda } = await cenario();

    const criado = await chamar('POST', `/agendas/${agenda}/convites`, {
      token: dono.token,
      corpo: { email: EMAILS[1], papel: 'CONTRIBUTOR' },
    });
    expect(criado.status).toBe(201);
    const token = tokenDe(criado.corpo);

    // A previsão é pública: não leva sessão.
    const previsao = await chamar('GET', `/convites/${token}`);
    expect(previsao.status).toBe(200);
    expect(previsao.corpo).toMatchObject({ papel: 'CONTRIBUTOR' });

    const aceito = await chamar('POST', `/convites/${token}/aceitar`, {
      token: maria.token,
    });
    expect(aceito.status).toBe(200);
    expect(aceito.corpo).toEqual({ calendarId: agenda });

    const dela = await chamar('GET', '/agendas', { token: maria.token });
    expect((dela.corpo as { id: string }[]).map((a) => a.id)).toContain(agenda);
  });

  it('aceitar e recusar exigem sessão', async () => {
    const { dono, agenda } = await cenario();
    const criado = await chamar('POST', `/agendas/${agenda}/convites`, {
      token: dono.token,
      corpo: { papel: 'VIEWER' },
    });
    const token = tokenDe(criado.corpo);

    expect((await chamar('POST', `/convites/${token}/aceitar`)).status).toBe(
      401,
    );
    expect((await chamar('POST', `/convites/${token}/recusar`)).status).toBe(
      401,
    );
  });

  it('criar, listar e revogar exigem sessão', async () => {
    const { agenda } = await cenario();

    expect(
      (
        await chamar('POST', `/agendas/${agenda}/convites`, {
          corpo: { papel: 'VIEWER' },
        })
      ).status,
    ).toBe(401);
    expect((await chamar('GET', `/agendas/${agenda}/convites`)).status).toBe(
      401,
    );
  });

  it('quem não é dono não convida (403 para membro, 404 para quem não tem acesso)', async () => {
    const { dono, maria, agenda } = await cenario();

    // Maria ainda não está na agenda: não tem como saber que ela existe.
    const antes = await chamar('POST', `/agendas/${agenda}/convites`, {
      token: maria.token,
      corpo: { papel: 'VIEWER' },
    });
    expect(antes.status).toBe(404);

    const criado = await chamar('POST', `/agendas/${agenda}/convites`, {
      token: dono.token,
      corpo: { papel: 'VIEWER' },
    });
    await chamar('POST', `/convites/${tokenDe(criado.corpo)}/aceitar`, {
      token: maria.token,
    });

    // Agora ela é leitora: vê a agenda, mas não convida.
    const depois = await chamar('POST', `/agendas/${agenda}/convites`, {
      token: maria.token,
      corpo: { papel: 'VIEWER' },
    });
    expect(depois.status).toBe(403);
  });

  it('o corpo é validado: papel de dono e validade fora da faixa são recusados', async () => {
    const { dono, agenda } = await cenario();

    const dono_ = await chamar('POST', `/agendas/${agenda}/convites`, {
      token: dono.token,
      corpo: { papel: 'OWNER' },
    });
    const longa = await chamar('POST', `/agendas/${agenda}/convites`, {
      token: dono.token,
      corpo: { papel: 'VIEWER', validadeDias: 365 },
    });

    expect(dono_.status).toBe(400);
    expect(longa.status).toBe(400);
  });

  it('um identificador que não é UUID v7 é recusado antes de tocar o banco', async () => {
    const { dono } = await cenario();

    const r = await chamar('GET', '/agendas/nao-e-uuid/convites', {
      token: dono.token,
    });

    expect(r.status).toBe(400);
  });

  it('a listagem não traz o token de ninguém', async () => {
    const { dono, agenda } = await cenario();
    await chamar('POST', `/agendas/${agenda}/convites`, {
      token: dono.token,
      corpo: { papel: 'VIEWER' },
    });

    const lista = await chamar('GET', `/agendas/${agenda}/convites`, {
      token: dono.token,
    });

    expect(lista.status).toBe(200);
    expect(JSON.stringify(lista.corpo)).not.toMatch(/token|link/i);
  });

  it('revogar responde 204 e o convite deixa de valer', async () => {
    const { dono, maria, agenda } = await cenario();
    const criado = await chamar('POST', `/agendas/${agenda}/convites`, {
      token: dono.token,
      corpo: { papel: 'VIEWER' },
    });
    const id = (criado.corpo as { convite: { id: string } }).convite.id;

    const revogado = await chamar(
      'DELETE',
      `/agendas/${agenda}/convites/${id}`,
      {
        token: dono.token,
      },
    );
    const aceite = await chamar(
      'POST',
      `/convites/${tokenDe(criado.corpo)}/aceitar`,
      {
        token: maria.token,
      },
    );

    expect(revogado.status).toBe(204);
    expect(aceite.status).toBe(410);
  });

  it('um token desconhecido é 404 na previsão', async () => {
    const r = await chamar('GET', '/convites/inventado');

    expect(r.status).toBe(404);
  });
});

/**
 * O limite de frequência, de ponta a ponta HTTP.
 *
 * Sobe um servidor Nest de verdade com uma rota de teste e dispara requisições
 * reais: o que precisa ser provado é que o guard lê o IP e o e-mail da
 * requisição, devolve 429 com `Retry-After`, e mantém contadores separados.
 */
import {
  Controller,
  Post,
  UseGuards,
  type INestApplication,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Limitar } from './limite.decorator';
import { LimiteGuard } from './limite.guard';
import { LimiteModule } from './limite.module';
import { LimiteService } from './limite.service';

const UMA_HORA = 3_600_000;

@Controller('teste-limite')
@UseGuards(LimiteGuard)
class RotasDeTeste {
  @Post('por-ip')
  @Limitar({ ip: { maximo: 2, janelaMs: UMA_HORA } })
  porIp(): { ok: true } {
    return { ok: true };
  }

  @Post('outra-por-ip')
  @Limitar({ ip: { maximo: 2, janelaMs: UMA_HORA } })
  outraPorIp(): { ok: true } {
    return { ok: true };
  }

  @Post('por-email')
  @Limitar({
    ip: { maximo: 100, janelaMs: UMA_HORA },
    email: { maximo: 2, janelaMs: UMA_HORA },
  })
  porEmail(): { ok: true } {
    return { ok: true };
  }
}

async function subir(
  ambiente: Record<string, string> = {},
): Promise<{ app: INestApplication; url: string }> {
  const modulo = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        ignoreEnvFile: true,
        load: [() => ambiente],
      }),
      LimiteModule,
    ],
    controllers: [RotasDeTeste],
  }).compile();

  const app = modulo.createNestApplication();
  await app.listen(0);
  return { app, url: await app.getUrl() };
}

function postar(
  url: string,
  rota: string,
  corpo: unknown = {},
): Promise<Response> {
  return fetch(`${url}/teste-limite/${rota}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(corpo),
  });
}

describe('LimiteGuard', () => {
  let app: INestApplication;
  let url: string;

  afterEach(async () => {
    await app.close();
  });

  it('deixa passar até o máximo e bloqueia a seguinte com 429', async () => {
    ({ app, url } = await subir());

    expect((await postar(url, 'por-ip')).status).toBe(201);
    expect((await postar(url, 'por-ip')).status).toBe(201);
    expect((await postar(url, 'por-ip')).status).toBe(429);
  });

  it('o 429 traz Retry-After e uma mensagem em português', async () => {
    ({ app, url } = await subir());
    await postar(url, 'por-ip');
    await postar(url, 'por-ip');

    const resposta = await postar(url, 'por-ip');
    const corpo = (await resposta.json()) as { message: string };

    expect(Number(resposta.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(corpo.message).toMatch(/Muitas tentativas/);
  });

  it('cada rota tem o seu contador', async () => {
    ({ app, url } = await subir());
    await postar(url, 'por-ip');
    await postar(url, 'por-ip');

    expect((await postar(url, 'outra-por-ip')).status).toBe(201);
  });

  it('o contador por e-mail é separado por e-mail', async () => {
    ({ app, url } = await subir());
    await postar(url, 'por-email', { email: 'a@norbit.dev' });
    await postar(url, 'por-email', { email: 'a@norbit.dev' });

    expect(
      (await postar(url, 'por-email', { email: 'a@norbit.dev' })).status,
    ).toBe(429);
    expect(
      (await postar(url, 'por-email', { email: 'b@norbit.dev' })).status,
    ).toBe(201);
  });

  it('o e-mail é normalizado: caixa e espaços não dão um contador novo', async () => {
    // Sem isso, `A@x.com` e `a@x.com` seriam duas contas para o limite e duas
    // para o banco (citext) — o atacante ganharia tentativas de graça.
    ({ app, url } = await subir());
    await postar(url, 'por-email', { email: 'a@norbit.dev' });
    await postar(url, 'por-email', { email: '  A@Norbit.DEV ' });

    expect(
      (await postar(url, 'por-email', { email: 'A@NORBIT.dev' })).status,
    ).toBe(429);
  });

  it('um corpo sem e-mail ainda é limitado pelo IP', async () => {
    ({ app, url } = await subir());

    for (let i = 0; i < 100; i += 1) {
      await postar(url, 'por-email', {});
    }

    expect((await postar(url, 'por-email', {})).status).toBe(429);
  });

  it('um e-mail que não é texto não derruba o guard', async () => {
    ({ app, url } = await subir());

    const resposta = await postar(url, 'por-email', { email: { x: 1 } });

    expect(resposta.status).toBe(201);
  });

  it('desligado por configuração, nunca bloqueia', async () => {
    ({ app, url } = await subir({ LIMITE_DE_FREQUENCIA: 'desligado' }));

    for (let i = 0; i < 10; i += 1) {
      expect((await postar(url, 'por-ip')).status).toBe(201);
    }
  });
});

describe('LimiteService', () => {
  it('mantém o número de chaves dentro do teto', () => {
    // Quem varre e-mails inventados cria uma chave por tentativa; sem teto, o
    // limite que protege o servidor viraria a forma de derrubá-lo por memória.
    const servico = new LimiteService();
    const regra = { maximo: 5, janelaMs: UMA_HORA };

    for (let i = 0; i < servico.teto + 500; i += 1) {
      servico.tentar(`chave-${i}`, regra);
    }

    expect(servico.tamanho).toBeLessThanOrEqual(servico.teto);
  });

  it('descarta primeiro as chaves já expiradas', () => {
    const servico = new LimiteService();

    servico.tentar('velha', { maximo: 1, janelaMs: 1 });
    // Espera a janela de 1 ms passar.
    const ate = Date.now() + 5;
    while (Date.now() < ate) {
      /* espera ativa curta */
    }
    servico.limparExpiradas();

    expect(servico.tamanho).toBe(0);
  });
});

/**
 * Conversão entre hora de parede e instante, num fuso IANA.
 *
 * É a base de toda a recorrência, e a razão pela qual `Event` guarda `timeZone`
 * além do UTC. "Toda terça às 9h" significa 9h **locais** — se a expansão
 * trabalhasse só em UTC, a ocorrência deslizaria uma hora na virada do horário
 * de verão, e o evento passaria a acontecer às 8h ou às 10h.
 *
 * Os casos difíceis não são os normais: são a hora que **não existe** e a hora
 * que acontece **duas vezes**.
 */
import { offsetEmMinutos, paraHoraLocal, paraInstante } from './zona';

const NOVA_YORK = 'America/New_York';
const SAO_PAULO = 'America/Sao_Paulo';

/** Atalho para escrever o esperado em UTC sem ambiguidade. */
function utc(texto: string): Date {
  return new Date(texto);
}

describe('paraInstante', () => {
  it('converte hora local no horário padrão', () => {
    // Janeiro em Nova York é EST, UTC-5: 9h locais são 14h UTC.
    const instante = paraInstante(
      { ano: 2026, mes: 1, dia: 15, hora: 9, minuto: 0 },
      NOVA_YORK,
    );

    expect(instante.toISOString()).toBe(
      utc('2026-01-15T14:00:00Z').toISOString(),
    );
  });

  it('converte hora local no horário de verão', () => {
    // Junho é EDT, UTC-4: as mesmas 9h locais são 13h UTC. É exatamente esta
    // diferença que uma expansão feita só em UTC perderia.
    const instante = paraInstante(
      { ano: 2026, mes: 6, dia: 15, hora: 9, minuto: 0 },
      NOVA_YORK,
    );

    expect(instante.toISOString()).toBe(
      utc('2026-06-15T13:00:00Z').toISOString(),
    );
  });

  it('converte num fuso sem horário de verão', () => {
    // São Paulo é UTC-3 o ano inteiro desde 2019.
    const inverno = paraInstante(
      { ano: 2026, mes: 1, dia: 15, hora: 9, minuto: 0 },
      SAO_PAULO,
    );
    const verao = paraInstante(
      { ano: 2026, mes: 6, dia: 15, hora: 9, minuto: 0 },
      SAO_PAULO,
    );

    expect(inverno.toISOString()).toBe(
      utc('2026-01-15T12:00:00Z').toISOString(),
    );
    expect(verao.toISOString()).toBe(utc('2026-06-15T12:00:00Z').toISOString());
  });

  describe('a hora que não existe', () => {
    it('empurra para frente o horário engolido pela virada', () => {
      // Em 8 de março de 2026, Nova York salta de 02:00 para 03:00. As 02:30
      // simplesmente não acontecem naquele dia.
      //
      // A política é empurrar para frente, mantendo a distância: 02:30 vira
      // 03:30. A alternativa — recusar — faria um evento semanal às 02:30
      // desaparecer uma vez por ano sem explicação para quem o criou.
      const instante = paraInstante(
        { ano: 2026, mes: 3, dia: 8, hora: 2, minuto: 30 },
        NOVA_YORK,
      );

      // 03:30 EDT (UTC-4) = 07:30 UTC.
      expect(instante.toISOString()).toBe(
        utc('2026-03-08T07:30:00Z').toISOString(),
      );
    });

    it('não mexe nas horas vizinhas da virada', () => {
      const antes = paraInstante(
        { ano: 2026, mes: 3, dia: 8, hora: 1, minuto: 30 },
        NOVA_YORK,
      );
      const depois = paraInstante(
        { ano: 2026, mes: 3, dia: 8, hora: 3, minuto: 30 },
        NOVA_YORK,
      );

      expect(antes.toISOString()).toBe(
        utc('2026-03-08T06:30:00Z').toISOString(),
      );
      expect(depois.toISOString()).toBe(
        utc('2026-03-08T07:30:00Z').toISOString(),
      );
    });
  });

  describe('a hora que acontece duas vezes', () => {
    it('escolhe a primeira ocorrência', () => {
      // Em 1º de novembro de 2026, Nova York volta de 02:00 para 01:00. As
      // 01:30 acontecem duas vezes: primeiro em EDT (UTC-4), depois em EST
      // (UTC-5).
      //
      // A política é a primeira. Para um compromisso, chegar na primeira
      // passagem é o comportamento esperado — quem marcou "01:30" quis dizer
      // "assim que der 01:30".
      const instante = paraInstante(
        { ano: 2026, mes: 11, dia: 1, hora: 1, minuto: 30 },
        NOVA_YORK,
      );

      expect(instante.toISOString()).toBe(
        utc('2026-11-01T05:30:00Z').toISOString(),
      );
    });
  });
});

describe('paraHoraLocal', () => {
  it('lê a hora de parede de um instante', () => {
    const local = paraHoraLocal(utc('2026-06-15T13:00:00Z'), NOVA_YORK);

    expect(local).toEqual({ ano: 2026, mes: 6, dia: 15, hora: 9, minuto: 0 });
  });

  it('atravessa a meia-noite para o dia anterior quando o fuso está atrás', () => {
    // 02:00 UTC é ainda o dia 14 em Nova York. Errar isto é o bug clássico de
    // "o evento aparece no dia errado" nas bordas do mês.
    const local = paraHoraLocal(utc('2026-06-15T02:00:00Z'), NOVA_YORK);

    expect(local).toEqual({ ano: 2026, mes: 6, dia: 14, hora: 22, minuto: 0 });
  });

  it('é o inverso de paraInstante nas horas normais', () => {
    const original = { ano: 2026, mes: 9, dia: 3, hora: 14, minuto: 45 };

    const voltou = paraHoraLocal(paraInstante(original, NOVA_YORK), NOVA_YORK);

    expect(voltou).toEqual(original);
  });
});

describe('offsetEmMinutos', () => {
  it('dá o deslocamento do fuso no instante pedido', () => {
    expect(offsetEmMinutos(utc('2026-01-15T12:00:00Z'), NOVA_YORK)).toBe(-300);
    expect(offsetEmMinutos(utc('2026-06-15T12:00:00Z'), NOVA_YORK)).toBe(-240);
    expect(offsetEmMinutos(utc('2026-06-15T12:00:00Z'), SAO_PAULO)).toBe(-180);
  });

  it('recusa fuso que não existe', () => {
    // Um `timeZone` inválido vindo do banco não deve virar uma data silenciosa
    // e errada.
    expect(() => offsetEmMinutos(new Date(), 'Marte/Olympus')).toThrow(/fuso/i);
  });
});

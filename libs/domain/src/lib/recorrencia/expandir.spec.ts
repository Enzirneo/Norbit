/**
 * A expansão de recorrência.
 *
 * O roadmap chama esta parte de "risco desta fase: é onde quase todo projeto
 * de calendário erra". Então o teste vem antes, e cobre o que erra: horário de
 * verão, mês que não tem o dia pedido, limite por contagem versus por data, e
 * a diferença entre "está no intervalo consultado" e "é a enésima ocorrência".
 */
import { expandir, type EventoRecorrente } from './expandir';

const NOVA_YORK = 'America/New_York';
const SAO_PAULO = 'America/Sao_Paulo';

function em(iso: string): Date {
  return new Date(iso);
}

/** Um evento de uma hora, começando no instante dado. */
function evento(opcoes: {
  inicio: string;
  fim?: string;
  fuso?: string;
  regra?: string | null;
  datasExcluidas?: string[];
}): EventoRecorrente {
  return {
    inicio: em(opcoes.inicio),
    fim: em(opcoes.fim ?? opcoes.inicio),
    fuso: opcoes.fuso ?? SAO_PAULO,
    regra: opcoes.regra ?? null,
    datasExcluidas: (opcoes.datasExcluidas ?? []).map(em),
  };
}

function inicios(ocorrencias: { inicio: Date }[]): string[] {
  return ocorrencias.map((o) => o.inicio.toISOString());
}

const ANO_DE_2026 = {
  de: em('2026-01-01T00:00:00Z'),
  ate: em('2027-01-01T00:00:00Z'),
};

describe('expandir', () => {
  describe('evento sem recorrência', () => {
    it('devolve a única ocorrência quando ela cai no intervalo', () => {
      const r = expandir(
        evento({ inicio: '2026-03-10T12:00:00Z', fim: '2026-03-10T13:00:00Z' }),
        ANO_DE_2026,
      );

      expect(inicios(r)).toEqual(['2026-03-10T12:00:00.000Z']);
    });

    it('devolve vazio quando ela cai fora', () => {
      const r = expandir(
        evento({ inicio: '2025-03-10T12:00:00Z' }),
        ANO_DE_2026,
      );

      expect(r).toEqual([]);
    });

    it('inclui o evento que começa antes do intervalo e termina dentro', () => {
      // A viagem de uma semana que começou no mês passado tem de aparecer na
      // visão deste mês. Filtrar só por início a esconderia.
      const r = expandir(
        evento({ inicio: '2026-02-26T12:00:00Z', fim: '2026-03-03T12:00:00Z' }),
        { de: em('2026-03-01T00:00:00Z'), ate: em('2026-04-01T00:00:00Z') },
      );

      expect(inicios(r)).toEqual(['2026-02-26T12:00:00.000Z']);
    });
  });

  describe('o caso que mais quebra implementações: horário de verão', () => {
    it('mantém a hora local nas duas pontas da virada', () => {
      // "Toda terça e quinta às 9h" em Nova York, atravessando 8 de março.
      // Antes da virada 9h locais são 14h UTC; depois, 13h UTC. Uma expansão
      // feita em UTC manteria 14h e o evento passaria a acontecer às 10h.
      const r = expandir(
        evento({
          inicio: '2026-03-03T14:00:00Z', // terça, 09:00 EST
          fim: '2026-03-03T15:00:00Z',
          fuso: NOVA_YORK,
          regra: 'FREQ=WEEKLY;BYDAY=TU,TH',
        }),
        { de: em('2026-03-01T00:00:00Z'), ate: em('2026-03-15T00:00:00Z') },
      );

      expect(inicios(r)).toEqual([
        '2026-03-03T14:00:00.000Z', // ter 3, EST
        '2026-03-05T14:00:00.000Z', // qui 5, EST
        '2026-03-10T13:00:00.000Z', // ter 10, já EDT
        '2026-03-12T13:00:00.000Z', // qui 12, EDT
      ]);
    });

    it('o fim acompanha o início: 09:00–10:00 continua 09:00–10:00 local', () => {
      const r = expandir(
        evento({
          inicio: '2026-03-03T14:00:00Z', // 09:00 EST
          fim: '2026-03-03T15:00:00Z', // 10:00 EST
          fuso: NOVA_YORK,
          regra: 'FREQ=WEEKLY;BYDAY=TU',
        }),
        { de: em('2026-03-09T00:00:00Z'), ate: em('2026-03-11T00:00:00Z') },
      );

      expect(r).toHaveLength(1);
      // 09:00 e 10:00 EDT.
      expect(r[0].inicio.toISOString()).toBe('2026-03-10T13:00:00.000Z');
      expect(r[0].fim.toISOString()).toBe('2026-03-10T14:00:00.000Z');
    });

    it('mantém a duração exata no evento que atravessa a virada', () => {
      // Este é o caso que distingue duração exata de duração de parede, e o
      // anterior **não** distingue: num evento de uma hora que não atravessa
      // virada, as duas interpretações dão o mesmo resultado.
      //
      // Sábado 23:00 às domingo 02:00, três horas. Na noite em que o relógio
      // volta, continuam três horas reais — e o relógio marca 01:00 no fim, não
      // 02:00. É o que a RFC 5545 define para evento com hora e DTEND.
      const r = expandir(
        evento({
          inicio: '2026-10-25T03:00:00Z', // sáb 24, 23:00 EDT
          fim: '2026-10-25T06:00:00Z', // dom 25, 02:00 EDT
          fuso: NOVA_YORK,
          regra: 'FREQ=WEEKLY;BYDAY=SA',
        }),
        { de: em('2026-10-31T00:00:00Z'), ate: em('2026-11-02T00:00:00Z') },
      );

      expect(r).toHaveLength(1);
      expect(r[0].inicio.toISOString()).toBe('2026-11-01T03:00:00.000Z');
      // Três horas depois, que naquela noite é 01:00 EST e não 02:00.
      expect(r[0].fim.toISOString()).toBe('2026-11-01T06:00:00.000Z');
      expect(r[0].fim.getTime() - r[0].inicio.getTime()).toBe(3 * 60 * 60_000);
    });
  });

  describe('frequência e intervalo', () => {
    it('expande diariamente', () => {
      const r = expandir(
        evento({ inicio: '2026-01-01T12:00:00Z', regra: 'FREQ=DAILY;COUNT=3' }),
        ANO_DE_2026,
      );

      expect(inicios(r)).toEqual([
        '2026-01-01T12:00:00.000Z',
        '2026-01-02T12:00:00.000Z',
        '2026-01-03T12:00:00.000Z',
      ]);
    });

    it('respeita o intervalo', () => {
      const r = expandir(
        evento({
          inicio: '2026-01-01T12:00:00Z',
          regra: 'FREQ=DAILY;INTERVAL=3;COUNT=3',
        }),
        ANO_DE_2026,
      );

      expect(inicios(r)).toEqual([
        '2026-01-01T12:00:00.000Z',
        '2026-01-04T12:00:00.000Z',
        '2026-01-07T12:00:00.000Z',
      ]);
    });

    it('expande de duas em duas semanas', () => {
      const r = expandir(
        evento({
          inicio: '2026-01-05T12:00:00Z', // segunda
          regra: 'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO;COUNT=3',
        }),
        ANO_DE_2026,
      );

      expect(inicios(r)).toEqual([
        '2026-01-05T12:00:00.000Z',
        '2026-01-19T12:00:00.000Z',
        '2026-02-02T12:00:00.000Z',
      ]);
    });

    it('expande anualmente', () => {
      const r = expandir(
        evento({
          inicio: '2026-07-04T12:00:00Z',
          regra: 'FREQ=YEARLY;COUNT=2',
        }),
        { de: em('2026-01-01T00:00:00Z'), ate: em('2028-01-01T00:00:00Z') },
      );

      expect(inicios(r)).toEqual([
        '2026-07-04T12:00:00.000Z',
        '2027-07-04T12:00:00.000Z',
      ]);
    });
  });

  describe('mensal', () => {
    it('pula os meses que não têm o dia pedido, em vez de aproximar', () => {
      // Dia 31 não existe em fevereiro, abril, junho... A RFC manda **ignorar**
      // essas datas. Aproximar para o dia 30 ou 28 seria inventar um
      // compromisso num dia que a pessoa não escolheu.
      const r = expandir(
        evento({
          inicio: '2026-01-31T12:00:00Z',
          regra: 'FREQ=MONTHLY;BYMONTHDAY=31',
        }),
        { de: em('2026-01-01T00:00:00Z'), ate: em('2026-06-01T00:00:00Z') },
      );

      expect(inicios(r)).toEqual([
        '2026-01-31T12:00:00.000Z',
        '2026-03-31T12:00:00.000Z',
        '2026-05-31T12:00:00.000Z',
      ]);
    });

    it('entende o último dia do mês', () => {
      const r = expandir(
        evento({
          inicio: '2026-01-31T12:00:00Z',
          regra: 'FREQ=MONTHLY;BYMONTHDAY=-1',
        }),
        { de: em('2026-01-01T00:00:00Z'), ate: em('2026-04-01T00:00:00Z') },
      );

      expect(inicios(r)).toEqual([
        '2026-01-31T12:00:00.000Z',
        '2026-02-28T12:00:00.000Z',
        '2026-03-31T12:00:00.000Z',
      ]);
    });

    it('entende a segunda terça do mês', () => {
      const r = expandir(
        evento({
          inicio: '2026-01-13T12:00:00Z', // segunda terça de janeiro
          regra: 'FREQ=MONTHLY;BYDAY=2TU',
        }),
        { de: em('2026-01-01T00:00:00Z'), ate: em('2026-04-01T00:00:00Z') },
      );

      expect(inicios(r)).toEqual([
        '2026-01-13T12:00:00.000Z',
        '2026-02-10T12:00:00.000Z',
        '2026-03-10T12:00:00.000Z',
      ]);
    });

    it('entende a última sexta do mês', () => {
      const r = expandir(
        evento({
          inicio: '2026-01-30T12:00:00Z',
          regra: 'FREQ=MONTHLY;BYDAY=-1FR',
        }),
        { de: em('2026-01-01T00:00:00Z'), ate: em('2026-04-01T00:00:00Z') },
      );

      expect(inicios(r)).toEqual([
        '2026-01-30T12:00:00.000Z',
        '2026-02-27T12:00:00.000Z',
        '2026-03-27T12:00:00.000Z',
      ]);
    });
  });

  describe('limites', () => {
    it('conta ocorrências desde o começo da série, não desde o intervalo', () => {
      // `COUNT=3` são três ocorrências na vida da série. Consultar só o
      // segundo mês não "renova" a contagem — erro fácil de cometer e difícil
      // de notar, porque a visão de um mês isolado pareceria correta.
      const r = expandir(
        evento({
          inicio: '2026-01-01T12:00:00Z',
          regra: 'FREQ=MONTHLY;COUNT=3',
        }),
        { de: em('2026-04-01T00:00:00Z'), ate: em('2026-12-01T00:00:00Z') },
      );

      expect(r).toEqual([]);
    });

    it('para na data de UNTIL, incluindo-a', () => {
      const r = expandir(
        evento({
          inicio: '2026-01-01T12:00:00Z',
          regra: 'FREQ=DAILY;UNTIL=20260103T120000Z',
        }),
        ANO_DE_2026,
      );

      expect(inicios(r)).toEqual([
        '2026-01-01T12:00:00.000Z',
        '2026-01-02T12:00:00.000Z',
        '2026-01-03T12:00:00.000Z',
      ]);
    });
  });

  describe('excluir só este', () => {
    it('remove a ocorrência cuja data está na lista de exclusões', () => {
      const r = expandir(
        evento({
          inicio: '2026-01-01T12:00:00Z',
          regra: 'FREQ=DAILY;COUNT=4',
          datasExcluidas: ['2026-01-02T12:00:00Z', '2026-01-03T12:00:00Z'],
        }),
        ANO_DE_2026,
      );

      expect(inicios(r)).toEqual([
        '2026-01-01T12:00:00.000Z',
        '2026-01-04T12:00:00.000Z',
      ]);
    });

    it('a exclusão não devolve a vaga para a contagem', () => {
      // `COUNT=4` com duas exclusões dá duas ocorrências, não quatro: a
      // contagem é da regra, e a exclusão vem depois.
      const r = expandir(
        evento({
          inicio: '2026-01-01T12:00:00Z',
          regra: 'FREQ=DAILY;COUNT=4',
          datasExcluidas: ['2026-01-02T12:00:00Z', '2026-01-03T12:00:00Z'],
        }),
        ANO_DE_2026,
      );

      expect(r).toHaveLength(2);
    });
  });

  describe('identidade da ocorrência', () => {
    it('carrega o início original, que é como a exceção se refere a ela', () => {
      // `Event.originalStartsAt` aponta para este valor: é o que permite
      // "editar só este" substituir uma instância da série.
      const r = expandir(
        evento({ inicio: '2026-01-01T12:00:00Z', regra: 'FREQ=DAILY;COUNT=2' }),
        ANO_DE_2026,
      );

      expect(r[1].inicioOriginal.toISOString()).toBe(
        '2026-01-02T12:00:00.000Z',
      );
    });
  });

  describe('a data de início que não casa com a regra', () => {
    it('não inventa uma ocorrência fora da regra', () => {
      // Começo numa segunda, regra às terças. A regra manda: a segunda não é
      // ocorrência. A interface sempre cria a regra a partir da data de
      // início, então isto só acontece com regra escrita à mão.
      const r = expandir(
        evento({
          inicio: '2026-01-05T12:00:00Z', // segunda
          regra: 'FREQ=WEEKLY;BYDAY=TU;COUNT=2',
        }),
        ANO_DE_2026,
      );

      expect(inicios(r)).toEqual([
        '2026-01-06T12:00:00.000Z',
        '2026-01-13T12:00:00.000Z',
      ]);
    });
  });

  describe('proteção contra regra patológica', () => {
    it('recusa expandir uma série sem fim por um intervalo absurdo', () => {
      // Sem limite, uma consulta de "todos os dias" por mil anos travaria o
      // servidor. O erro é explícito para que a causa apareça no log.
      expect(() =>
        expandir(
          evento({ inicio: '2026-01-01T12:00:00Z', regra: 'FREQ=DAILY' }),
          {
            de: em('2026-01-01T00:00:00Z'),
            ate: em('3026-01-01T00:00:00Z'),
          },
        ),
      ).toThrow(/limite/i);
    });
  });
});

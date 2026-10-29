/**
 * O seletor de repetição do formulário.
 *
 * Ele oferece quatro opções e a RFC 5545 tem muito mais. A pergunta que estes
 * testes respondem não é "ele monta a regra certa" — é **o que ele faz com uma
 * regra que não sabe expressar**.
 *
 * A resposta tem de ser: preserva, intacta. Um seletor que mostra "toda semana"
 * para `FREQ=WEEKLY;UNTIL=20261231T000000Z` e salva `FREQ=WEEKLY` apagou o fim
 * da série sem avisar — e quem salvou só queria corrigir o título.
 */
import { lerRepeticao, montarRrule, type Repeticao } from './repeticao';

describe('montarRrule', () => {
  it.each([
    [{ tipo: 'nao-repete' } as Repeticao, null],
    [{ tipo: 'diaria' } as Repeticao, 'FREQ=DAILY'],
    [{ tipo: 'mensal' } as Repeticao, 'FREQ=MONTHLY'],
    [{ tipo: 'anual' } as Repeticao, 'FREQ=YEARLY'],
    [
      { tipo: 'semanal', dias: ['TU', 'TH'] } as Repeticao,
      'FREQ=WEEKLY;BYDAY=TU,TH',
    ],
  ])('%j vira %s', (escolha, esperado) => {
    expect(montarRrule(escolha)).toBe(esperado);
  });

  it('ordena os dias da semana de forma canônica', () => {
    // Para que a ida e volta feche: sem ordem fixa, salvar duas vezes sem mexer
    // em nada produziria dois textos diferentes no banco.
    expect(montarRrule({ tipo: 'semanal', dias: ['TH', 'TU', 'MO'] })).toBe(
      'FREQ=WEEKLY;BYDAY=MO,TU,TH',
    );
  });

  it('recusa semanal sem nenhum dia', () => {
    // O formulário não deve permitir, e se permitir o erro aparece aqui em vez
    // de virar `FREQ=WEEKLY;BYDAY=` — que o parser recusaria com uma mensagem
    // sobre sintaxe, longe da causa.
    expect(() => montarRrule({ tipo: 'semanal', dias: [] })).toThrow(/dia/i);
  });

  it('devolve a regra personalizada sem tocar nela', () => {
    const original = 'FREQ=MONTHLY;BYDAY=2TU;COUNT=10';

    expect(montarRrule({ tipo: 'personalizada', regra: original })).toBe(
      original,
    );
  });
});

describe('lerRepeticao', () => {
  it('reconhece a ausência de regra', () => {
    expect(lerRepeticao(null)).toEqual({ tipo: 'nao-repete' });
  });

  it.each([
    ['FREQ=DAILY', { tipo: 'diaria' }],
    ['FREQ=MONTHLY', { tipo: 'mensal' }],
    ['FREQ=YEARLY', { tipo: 'anual' }],
    ['FREQ=WEEKLY;BYDAY=TU,TH', { tipo: 'semanal', dias: ['TU', 'TH'] }],
  ])('reconhece %s', (regra, esperado) => {
    expect(lerRepeticao(regra)).toEqual(esperado);
  });

  describe('o que o seletor não expressa vira personalizada, intacta', () => {
    it.each([
      // Fim da série: o seletor não tem controle de "até quando".
      'FREQ=WEEKLY;BYDAY=TU;UNTIL=20261231T000000Z',
      'FREQ=DAILY;COUNT=10',
      // Intervalo diferente de 1.
      'FREQ=WEEKLY;INTERVAL=2;BYDAY=TU',
      // Ordem no mês, e dia do mês explícito.
      'FREQ=MONTHLY;BYDAY=2TU',
      'FREQ=MONTHLY;BYMONTHDAY=-1',
      // Semanal sem BYDAY segue o dia do início, e amarrar um dia explícito
      // mudaria o significado se a data de início também mudasse no mesmo
      // salvamento.
      'FREQ=WEEKLY',
    ])('%s', (regra) => {
      expect(lerRepeticao(regra)).toEqual({ tipo: 'personalizada', regra });
    });

    it('e uma regra que o próprio parser recusa também é preservada', () => {
      // `BYSETPOS` não é suportado (ver docs/08) e `lerRrule` lança. O
      // formulário não pode quebrar ao abrir um evento assim — e salvar sem
      // mexer tem de devolver a mesma regra, para a API recusar com a mensagem
      // dela em vez de o formulário apagar o campo.
      const regra = 'FREQ=MONTHLY;BYDAY=TU;BYSETPOS=2';

      expect(lerRepeticao(regra)).toEqual({ tipo: 'personalizada', regra });
    });
  });

  it('normaliza a ordem dos dias ao ler', () => {
    // `BYDAY=TH,TU` e `BYDAY=TU,TH` são a mesma regra para a RFC. Ler na ordem
    // canônica é o que faz a ida e volta fechar; é a única reescrita que esta
    // função se permite, e ela não muda o significado.
    expect(lerRepeticao('FREQ=WEEKLY;BYDAY=TH,TU')).toEqual({
      tipo: 'semanal',
      dias: ['TU', 'TH'],
    });
  });
});

describe('a ida e volta', () => {
  it.each([
    null,
    'FREQ=DAILY',
    'FREQ=WEEKLY;BYDAY=MO,WE,FR',
    'FREQ=MONTHLY',
    'FREQ=YEARLY',
    // As personalizadas são a parte que importa: elas atravessam sem alteração.
    'FREQ=WEEKLY;BYDAY=TU;UNTIL=20261231T000000Z',
    'FREQ=DAILY;COUNT=10',
    'FREQ=MONTHLY;BYDAY=2TU',
    'FREQ=MONTHLY;BYDAY=TU;BYSETPOS=2',
  ])('%s volta igual', (regra) => {
    // A propriedade que protege o produto: abrir um evento e salvar sem mexer
    // na repetição não altera a regra. Nenhuma.
    expect(montarRrule(lerRepeticao(regra))).toBe(regra);
  });
});

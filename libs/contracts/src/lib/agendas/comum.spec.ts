import { corHex, fusoIana, instante } from './comum';

describe('corHex', () => {
  it('normaliza para minúscula', () => {
    expect(corHex.parse('#6D7CFF')).toBe('#6d7cff');
  });

  it('recusa a forma de três dígitos', () => {
    // Expandir `#f0a` para `#ff00aa` deixaria duas grafias da mesma cor no
    // banco, e a cor é comparada como texto.
    expect(corHex.safeParse('#f0a').success).toBe(false);
  });

  it('recusa cor sem cerquilha e nome de cor', () => {
    expect(corHex.safeParse('6d7cff').success).toBe(false);
    expect(corHex.safeParse('rebeccapurple').success).toBe(false);
  });
});

describe('fusoIana', () => {
  it('aceita fuso que o runtime conhece', () => {
    expect(fusoIana.parse('America/Sao_Paulo')).toBe('America/Sao_Paulo');
    expect(fusoIana.parse('UTC')).toBe('UTC');
  });

  it('recusa fuso inventado', () => {
    // Gravar isto faria toda consulta daquela série falhar em runtime, longe
    // da requisição que causou.
    expect(fusoIana.safeParse('Marte/Olympus').success).toBe(false);
  });

  describe('recusa deslocamento fixo no lugar do fuso', () => {
    // O `Intl` **aceita** estas duas formas desde a ES2024, e aceitá-las aqui
    // destruiria a razão de o campo existir: um número não sabe quando o
    // horário de verão começa.
    it.each(['-03:00', '+0530'])('%s', (valor) => {
      expect(fusoIana.safeParse(valor).success).toBe(false);
    });
  });

  describe('canoniza, porque o fuso é comparado como texto', () => {
    it.each([
      ['america/sao_paulo', 'America/Sao_Paulo'],
      ['US/Pacific', 'America/Los_Angeles'],
      ['utc', 'UTC'],
    ])('%s -> %s', (entrada, esperado) => {
      expect(fusoIana.parse(entrada)).toBe(esperado);
    });
  });
});

describe('instante', () => {
  it('converte ISO com deslocamento para Date', () => {
    expect(instante.parse('2026-11-01T12:30:00Z').toISOString()).toBe(
      '2026-11-01T12:30:00.000Z',
    );
    expect(instante.parse('2026-11-01T09:30:00-03:00').toISOString()).toBe(
      '2026-11-01T12:30:00.000Z',
    );
  });

  it('recusa data sem deslocamento', () => {
    // Sem deslocamento o servidor interpretaria no fuso dele, e o evento
    // apareceria na hora errada para quem não roda em UTC.
    expect(instante.safeParse('2026-11-01T12:30:00').success).toBe(false);
  });

  it('recusa data sem hora', () => {
    expect(instante.safeParse('2026-11-01').success).toBe(false);
  });
});

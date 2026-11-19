import {
  atualizarPreferenciasSchema,
  preferenciasDaAgendaSchema,
} from './preferencias';

describe('atualizarPreferenciasSchema', () => {
  it('o accentColor antigo não é mais aceito: é descartado', () => {
    expect(
      atualizarPreferenciasSchema.parse({ density: 1, accentColor: '#4adebb' }),
    ).toEqual({ density: 1 });
  });

  it('um pedido só com o accentColor antigo fica vazio e é recusado', () => {
    expect(
      atualizarPreferenciasSchema.safeParse({ accentColor: '#4adebb' }).success,
    ).toBe(false);
  });

  it('recusa densidade fora da escala', () => {
    for (const density of [-1, 3, 1.5]) {
      expect(atualizarPreferenciasSchema.safeParse({ density }).success).toBe(
        false,
      );
    }
  });

  it('aceita as três densidades', () => {
    for (const density of [0, 1, 2]) {
      expect(atualizarPreferenciasSchema.parse({ density }).density).toBe(
        density,
      );
    }
  });

  it('recusa início de semana fora de 0 a 6', () => {
    expect(
      atualizarPreferenciasSchema.safeParse({ weekStartsOn: 7 }).success,
    ).toBe(false);
  });

  it('recusa um PATCH vazio', () => {
    expect(atualizarPreferenciasSchema.safeParse({}).success).toBe(false);
  });

  it('não reescreve o que não foi informado', () => {
    // O mesmo cuidado de `agenda.ts`: padrão no schema compartilhado faria uma
    // alteração de densidade zerar a cor de destaque.
    expect(atualizarPreferenciasSchema.parse({ density: 0 })).toEqual({
      density: 0,
    });
  });

  it('descarta campos que não são preferências', () => {
    const preferencias = atualizarPreferenciasSchema.parse({
      density: 1,
      userId: 'outra-pessoa',
      emailEnabled: true,
    });

    expect(Object.keys(preferencias)).toEqual(['density']);
  });
});

describe('preferenciasDaAgendaSchema', () => {
  it('aceita esconder', () => {
    expect(preferenciasDaAgendaSchema.parse({ isHidden: true })).toEqual({
      isHidden: true,
    });
  });

  it('aceita limpar a cor própria com null', () => {
    // `null` é voltar para a cor da agenda; ausente é não mexer.
    expect(preferenciasDaAgendaSchema.parse({ colorOverride: null })).toEqual({
      colorOverride: null,
    });
  });

  it('a cor própria não está restrita à paleta de acentos', () => {
    // Ela é só uma cor de etiqueta: nada é derivado dela, e nada escreve texto
    // em cima. A restrição do acento existe porque dele derivam o hover, o
    // fundo de seleção e a cor do texto.
    expect(
      preferenciasDaAgendaSchema.parse({ colorOverride: '#123456' })
        .colorOverride,
    ).toBe('#123456');
  });

  it('recusa um PATCH vazio', () => {
    expect(preferenciasDaAgendaSchema.safeParse({}).success).toBe(false);
  });
});

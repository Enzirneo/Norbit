import { ACENTOS } from '@norbit/design-tokens';
import {
  atualizarPreferenciasSchema,
  preferenciasDaAgendaSchema,
} from './preferencias';

describe('atualizarPreferenciasSchema', () => {
  it('aceita um acento da paleta', () => {
    expect(
      atualizarPreferenciasSchema.parse({ accentColor: ACENTOS.aurora }),
    ).toEqual({ accentColor: ACENTOS.aurora });
  });

  it('normaliza a caixa antes de comparar com a paleta', () => {
    // `corHex` passa para minúscula, e a paleta é minúscula. Sem a
    // normalização antes do `refine`, um `#4ADEBB` válido seria recusado.
    expect(
      atualizarPreferenciasSchema.parse({ accentColor: '#4ADEBB' }).accentColor,
    ).toBe(ACENTOS.aurora);
  });

  it('recusa uma cor fora da paleta', () => {
    // Não é purismo: as cores companheiras do acento são derivadas dele, e
    // derivar com garantia de contraste para qualquer cor é outra entrega.
    expect(
      atualizarPreferenciasSchema.safeParse({ accentColor: '#123456' }).success,
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

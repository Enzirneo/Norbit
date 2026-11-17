import {
  atualizarAgendaSchema,
  criarAgendaSchema,
  transferirPosseSchema,
} from './agenda';

describe('criarAgendaSchema', () => {
  it('aplica os padrões do produto', () => {
    const agenda = criarAgendaSchema.parse({ name: 'Casa' });

    expect(agenda).toEqual({
      name: 'Casa',
      kind: 'PERSONAL',
      color: '#6d7cff',
    });
    // `timeZone` ausente de propósito: quem sabe o fuso de quem está criando é
    // o serviço, não o schema.
    expect(agenda.timeZone).toBeUndefined();
  });

  it('descarta campos que não são da pessoa que cria', () => {
    const agenda = criarAgendaSchema.parse({
      name: 'Casa',
      ownerId: 'outra-pessoa',
      isDefault: true,
    });

    expect('ownerId' in agenda).toBe(false);
    expect('isDefault' in agenda).toBe(false);
  });

  it('exige nome', () => {
    expect(criarAgendaSchema.safeParse({}).success).toBe(false);
    expect(criarAgendaSchema.safeParse({ name: '   ' }).success).toBe(false);
  });
});

describe('atualizarAgendaSchema', () => {
  it('não reescreve o que não foi informado', () => {
    // O defeito que este teste existe para impedir: com os padrões no schema
    // compartilhado, um PATCH só com o nome traria `color: '#6d7cff'` e a
    // agenda mudaria de cor sozinha. É o clássico "editei o nome e a agenda
    // ficou azul".
    const alteracao = atualizarAgendaSchema.parse({ name: 'Casa nova' });

    expect(alteracao).toEqual({ name: 'Casa nova' });
  });

  it('recusa um PATCH vazio', () => {
    expect(atualizarAgendaSchema.safeParse({}).success).toBe(false);
  });

  it('aceita arquivar', () => {
    expect(atualizarAgendaSchema.parse({ arquivada: true })).toEqual({
      arquivada: true,
    });
  });

  it('aceita limpar a descrição com null', () => {
    // `null` é apagar; ausente é não mexer. São coisas diferentes e o schema
    // precisa distinguir, ou não há como remover uma descrição.
    expect(atualizarAgendaSchema.parse({ description: null })).toEqual({
      description: null,
    });
  });
});

describe('transferirPosseSchema', () => {
  const ID = '0190a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a2b';

  it('aceita o identificador de quem recebe a posse', () => {
    expect(transferirPosseSchema.parse({ membroId: ID })).toEqual({
      membroId: ID,
    });
  });

  it('recusa identificador que não é um UUID', () => {
    expect(transferirPosseSchema.safeParse({ membroId: 'maria' }).success).toBe(
      false,
    );
  });

  it('recusa corpo sem o membro', () => {
    expect(transferirPosseSchema.safeParse({}).success).toBe(false);
  });
});

import {
  atualizarTarefaSchema,
  consultaDeTarefasSchema,
  criarTarefaSchema,
  moverTarefaSchema,
} from './tarefa';

describe('criarTarefaSchema', () => {
  it('aplica os padrões do produto', () => {
    expect(criarTarefaSchema.parse({ title: 'Comprar pão' })).toEqual({
      title: 'Comprar pão',
      priority: 'NONE',
      isDueAllDay: false,
      visibility: 'INHERITED',
    });
  });

  it('descarta campos que não são de quem cria', () => {
    const tarefa = criarTarefaSchema.parse({
      title: 'Comprar pão',
      createdById: 'outra-pessoa',
      position: 999,
      completedAt: '2020-01-01T00:00:00Z',
    });

    expect(Object.keys(tarefa).sort()).toEqual([
      'isDueAllDay',
      'priority',
      'title',
      'visibility',
    ]);
  });

  it('exige título', () => {
    expect(criarTarefaSchema.safeParse({ title: '   ' }).success).toBe(false);
  });
});

describe('atualizarTarefaSchema', () => {
  it('não reescreve o que não foi informado', () => {
    expect(atualizarTarefaSchema.parse({ title: 'Outro' })).toEqual({
      title: 'Outro',
    });
  });

  it('recusa um PATCH vazio', () => {
    expect(atualizarTarefaSchema.safeParse({}).success).toBe(false);
  });

  it('concluir é booleano na entrada', () => {
    // A data de conclusão é do servidor: o cliente não tem relógio confiável, e
    // "concluída hoje" depende de qual relógio decidiu.
    expect(atualizarTarefaSchema.parse({ concluida: true })).toEqual({
      concluida: true,
    });
    expect(atualizarTarefaSchema.parse({ concluida: false })).toEqual({
      concluida: false,
    });
  });

  it('aceita limpar o prazo e o responsável com null', () => {
    expect(
      atualizarTarefaSchema.parse({ dueAt: null, assigneeId: null }),
    ).toEqual({ dueAt: null, assigneeId: null });
  });
});

describe('moverTarefaSchema', () => {
  it('descreve o destino pelos vizinhos', () => {
    const a = '0193f0a0-0000-7000-8000-000000000001';
    const b = '0193f0a0-0000-7000-8000-000000000002';

    expect(moverTarefaSchema.parse({ anteriorId: a, proximaId: b })).toEqual({
      anteriorId: a,
      proximaId: b,
    });
  });

  it('aceita as duas bordas da lista', () => {
    const a = '0193f0a0-0000-7000-8000-000000000001';

    expect(
      moverTarefaSchema.parse({ anteriorId: null, proximaId: a }).anteriorId,
    ).toBeNull();
    expect(
      moverTarefaSchema.parse({ anteriorId: a, proximaId: null }).proximaId,
    ).toBeNull();
    expect(
      moverTarefaSchema.safeParse({ anteriorId: null, proximaId: null })
        .success,
    ).toBe(true);
  });

  it('recusa os dois vizinhos sendo a mesma tarefa', () => {
    // Não existe "entre A e A". Deixar passar faria o serviço pedir uma posição
    // com `anterior === proxima`, que a ordenação recusa — e o erro chegaria
    // como 500 em vez de 400.
    const a = '0193f0a0-0000-7000-8000-000000000001';

    expect(
      moverTarefaSchema.safeParse({ anteriorId: a, proximaId: a }).success,
    ).toBe(false);
  });
});

describe('consultaDeTarefasSchema', () => {
  it('por padrão esconde as concluídas', () => {
    // Uma lista de tarefas que nasce cheia de coisa resolvida não é uma lista
    // de tarefas.
    expect(consultaDeTarefasSchema.parse({}).incluirConcluidas).toBe(false);
  });

  it('aceita pedir as concluídas', () => {
    expect(
      consultaDeTarefasSchema.parse({ incluirConcluidas: 'true' })
        .incluirConcluidas,
    ).toBe(true);
  });

  it('recusa valor que não é booleano de query', () => {
    // Parâmetro de rota é texto. Aceitar qualquer coisa e tratar como falso
    // transformaria `incluirConcluidas=1` num filtro que não faz nada e
    // ninguém entende por quê.
    expect(
      consultaDeTarefasSchema.safeParse({ incluirConcluidas: '1' }).success,
    ).toBe(false);
  });

  it('lê a lista de agendas separada por vírgula', () => {
    const consulta = consultaDeTarefasSchema.parse({
      agendas:
        '0193f0a0-0000-7000-8000-000000000001, 0193f0a0-0000-7000-8000-000000000002',
    });

    expect(consulta.agendas).toHaveLength(2);
  });
});

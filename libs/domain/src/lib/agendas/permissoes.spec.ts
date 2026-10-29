/**
 * A matriz de autorização das agendas compartilhadas.
 *
 * Fica em `libs/domain` como função pura porque é **decisão**, não encanamento:
 * cada linha desta matriz é uma escolha de produto que precisa ser legível e
 * testável sem subir banco, Nest ou HTTP. O serviço só aplica o veredito.
 *
 * O erro clássico de autorização não é esquecer a verificação — é espalhá-la.
 * Quatro controllers com quatro `if (papel === 'OWNER' || ...)` divergem na
 * primeira alteração, e a divergência aparece como vazamento de dado.
 */
import {
  PAPEIS,
  podeNaAgenda,
  podeNoItem,
  type AcaoDeAgenda,
  type Papel,
} from './permissoes';

describe('podeNaAgenda', () => {
  it('todo papel vê a agenda', () => {
    // Quem não pode ver não é membro — a ausência de papel é a recusa, e ela
    // acontece antes de chegar aqui.
    for (const papel of PAPEIS) {
      expect(podeNaAgenda(papel, 'ver')).toBe(true);
    }
  });

  describe('criar conteúdo', () => {
    it('é o que distingue o VIEWER de todos os outros', () => {
      for (const acao of ['criar-evento', 'criar-tarefa'] as const) {
        expect(podeNaAgenda('OWNER', acao)).toBe(true);
        expect(podeNaAgenda('EDITOR', acao)).toBe(true);
        expect(podeNaAgenda('CONTRIBUTOR', acao)).toBe(true);
        expect(podeNaAgenda('VIEWER', acao)).toBe(false);
      }
    });

    it('evento e tarefa andam juntos', () => {
      // Hoje a regra é a mesma para os dois, e este teste é o que garante que
      // acrescentar uma entidade nova não deixe uma linha da matriz pela
      // metade — o papel ganharia a permissão por omissão.
      for (const papel of PAPEIS) {
        expect(podeNaAgenda(papel, 'criar-tarefa')).toBe(
          podeNaAgenda(papel, 'criar-evento'),
        );
      }
    });
  });

  describe('as três ações de dono', () => {
    const DE_DONO: readonly AcaoDeAgenda[] = [
      'editar-agenda',
      'excluir-agenda',
      'gerenciar-membros',
    ];

    it('só o OWNER as executa', () => {
      for (const acao of DE_DONO) {
        expect(podeNaAgenda('OWNER', acao)).toBe(true);
        expect(podeNaAgenda('EDITOR', acao)).toBe(false);
        expect(podeNaAgenda('CONTRIBUTOR', acao)).toBe(false);
        expect(podeNaAgenda('VIEWER', acao)).toBe(false);
      }
    });

    it('o EDITOR mexe no conteúdo, não na agenda', () => {
      // A distinção que dá sentido ao papel: ele edita qualquer evento, mas não
      // renomeia a agenda da família nem convida ninguém.
      expect(
        podeNoItem({
          papel: 'EDITOR',
          acao: 'editar-evento',
          ehAutor: false,
        }),
      ).toBe(true);
      expect(podeNaAgenda('EDITOR', 'editar-agenda')).toBe(false);
      expect(podeNaAgenda('EDITOR', 'gerenciar-membros')).toBe(false);
    });
  });
});

describe('podeNoItem', () => {
  it('OWNER e EDITOR mexem em evento de qualquer um', () => {
    for (const papel of ['OWNER', 'EDITOR'] as const) {
      expect(podeNoItem({ papel, acao: 'editar-evento', ehAutor: false })).toBe(
        true,
      );
      expect(
        podeNoItem({ papel, acao: 'excluir-evento', ehAutor: false }),
      ).toBe(true);
    }
  });

  describe('CONTRIBUTOR', () => {
    it('mexe no que ele criou', () => {
      expect(
        podeNoItem({
          papel: 'CONTRIBUTOR',
          acao: 'editar-evento',
          ehAutor: true,
        }),
      ).toBe(true);
      expect(
        podeNoItem({
          papel: 'CONTRIBUTOR',
          acao: 'excluir-evento',
          ehAutor: true,
        }),
      ).toBe(true);
    });

    it('não mexe no que outra pessoa criou', () => {
      // É a razão de o papel existir. Numa agenda de time, todo mundo precisa
      // lançar seus compromissos sem poder apagar os dos outros.
      expect(
        podeNoItem({
          papel: 'CONTRIBUTOR',
          acao: 'editar-evento',
          ehAutor: false,
        }),
      ).toBe(false);
      expect(
        podeNoItem({
          papel: 'CONTRIBUTOR',
          acao: 'excluir-evento',
          ehAutor: false,
        }),
      ).toBe(false);
    });
  });

  describe('VIEWER', () => {
    it('não mexe em nada', () => {
      expect(
        podeNoItem({
          papel: 'VIEWER',
          acao: 'editar-evento',
          ehAutor: false,
        }),
      ).toBe(false);
      expect(
        podeNoItem({
          papel: 'VIEWER',
          acao: 'excluir-evento',
          ehAutor: false,
        }),
      ).toBe(false);
    });

    it('nem no que ele mesmo criou antes de ser rebaixado', () => {
      // Autoria não é permissão: ela só **amplia** o que o papel já concede.
      // Rebaixar alguém a VIEWER tira o acesso de escrita por inteiro, que é o
      // que quem rebaixa está pedindo — do contrário o rebaixamento não
      // significaria nada para quem já havia criado eventos.
      expect(
        podeNoItem({ papel: 'VIEWER', acao: 'editar-evento', ehAutor: true }),
      ).toBe(false);
      expect(
        podeNoItem({
          papel: 'VIEWER',
          acao: 'excluir-evento',
          ehAutor: true,
        }),
      ).toBe(false);
    });
  });
});

describe('a matriz em si', () => {
  it('cobre os quatro papéis do banco, sem sobra nem falta', () => {
    // `PAPEIS` é derivado da matriz, então esta igualdade falha se alguém
    // acrescentar um papel no enum do Prisma e esquecer a linha aqui — o que
    // seria pior que falhar: o papel novo cairia no `??` de algum lugar e
    // ganharia permissão por omissão.
    expect([...PAPEIS].sort()).toEqual([
      'CONTRIBUTOR',
      'EDITOR',
      'OWNER',
      'VIEWER',
    ] satisfies Papel[]);
  });

  it('recusa um papel que não existe, em vez de liberar', () => {
    // Em runtime o papel vem do banco, e um valor inesperado (migration mal
    // aplicada, linha editada à mão) não pode virar permissão.
    const invalido = 'ADMIN' as Papel;

    expect(podeNaAgenda(invalido, 'ver')).toBe(false);
    expect(podeNaAgenda(invalido, 'criar-evento')).toBe(false);
    expect(
      podeNoItem({ papel: invalido, acao: 'editar-evento', ehAutor: true }),
    ).toBe(false);
  });
});

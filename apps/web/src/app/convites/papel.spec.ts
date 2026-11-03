import { papelSchema } from '@norbit/contracts';
import { PAPEIS_CONVIDAVEIS, rotuloDoPapel } from './papel';

describe('papéis de convite', () => {
  it('oferece só os papéis que a API aceita convidar', () => {
    expect(PAPEIS_CONVIDAVEIS.map((p) => p.valor)).toEqual([
      'EDITOR',
      'CONTRIBUTOR',
      'VIEWER',
    ]);
  });

  it('nunca oferece o dono: posse se transfere, não se convida', () => {
    expect(PAPEIS_CONVIDAVEIS.map((p) => p.valor)).not.toContain('OWNER');
  });

  it('tem rótulo para todo papel que existe', () => {
    for (const papel of papelSchema.options) {
      expect(rotuloDoPapel(papel)).not.toBe('');
    }
  });

  it('rotula o que o convidado vai poder fazer, e não o nome técnico', () => {
    expect(rotuloDoPapel('VIEWER')).toBe('Leitor');
    expect(rotuloDoPapel('EDITOR')).toBe('Editor');
  });
});

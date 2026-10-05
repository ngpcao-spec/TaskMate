import { taskPermissions, type Viewer } from './permissions';

const minh: Viewer = { role: 'child', memberId: 'm-minh', childId: 'c-minh' };
const parent: Viewer = { role: 'parent', memberId: 'm-p', childId: null };

describe('taskPermissions (SPEC v4)', () => {
  const todo = { child_id: 'c-minh', completed_at: null, validated_at: null };
  const pending = { child_id: 'c-minh', completed_at: 'x', validated_at: null };
  const validated = { child_id: 'c-minh', completed_at: 'x', validated_at: 'y' };

  it('parent : tous les droits ; peut valider seulement une tâche en attente', () => {
    expect(taskPermissions(parent, todo)).toEqual({ canToggle: true, canEdit: true, canDelete: true, canValidate: false });
    expect(taskPermissions(parent, pending).canValidate).toBe(true);
    expect(taskPermissions(parent, validated).canValidate).toBe(false);
  });
  it('enfant : coche et décoche tant que ce n’est pas validé', () => {
    expect(taskPermissions(minh, todo).canToggle).toBe(true);
    expect(taskPermissions(minh, pending).canToggle).toBe(true);
  });
  it('enfant : tâche validée = verrouillée', () => {
    expect(taskPermissions(minh, validated).canToggle).toBe(false);
  });
  it('enfant : ne crée/modifie/supprime/valide jamais rien', () => {
    for (const task of [todo, pending, validated]) {
      expect(taskPermissions(minh, task)).toMatchObject({ canEdit: false, canDelete: false, canValidate: false });
    }
  });
  it('enfant : aucun droit sur son frère', () => {
    expect(taskPermissions(minh, { ...todo, child_id: 'c-khang' })).toEqual({ canToggle: false, canEdit: false, canDelete: false, canValidate: false });
  });
});

import { isReadOnlyProfile, taskPermissions, type Viewer } from './permissions';

const minh: Viewer = { role: 'child', memberId: 'm-minh', childId: 'c-minh' };
const parent: Viewer = { role: 'parent', memberId: 'm-p', childId: null };

describe('taskPermissions', () => {
  it('parent : tous les droits', () => {
    expect(taskPermissions(parent, { child_id: 'c-khang', created_by: 'm-khang' })).toEqual({
      canToggle: true, canEdit: true, canDelete: true,
    });
  });
  it('enfant : coche la tâche créée par le parent mais ne la modifie pas', () => {
    expect(taskPermissions(minh, { child_id: 'c-minh', created_by: 'm-p' })).toEqual({
      canToggle: true, canEdit: false, canDelete: false,
    });
  });
  it('enfant : modifie et supprime ce qu’il a créé', () => {
    expect(taskPermissions(minh, { child_id: 'c-minh', created_by: 'm-minh' })).toEqual({
      canToggle: true, canEdit: true, canDelete: true,
    });
  });
  it('enfant : aucun droit sur son frère', () => {
    expect(taskPermissions(minh, { child_id: 'c-khang', created_by: 'm-khang' })).toEqual({
      canToggle: false, canEdit: false, canDelete: false,
    });
  });
});

describe('isReadOnlyProfile', () => {
  it('lecture seule pour le profil du frère uniquement', () => {
    expect(isReadOnlyProfile(minh, 'c-khang')).toBe(true);
    expect(isReadOnlyProfile(minh, 'c-minh')).toBe(false);
    expect(isReadOnlyProfile(parent, 'c-khang')).toBe(false);
  });
});

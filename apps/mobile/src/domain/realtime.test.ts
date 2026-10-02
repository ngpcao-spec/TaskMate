import { invalidationsFor, REALTIME_TABLES } from './realtime';

describe('invalidationsFor', () => {
  it('une tâche modifiée invalide les listes de l’enfant concerné et la tâche', () => {
    expect(invalidationsFor('tasks', { id: 't1', child_id: 'c1' })).toEqual([['tasks', 'c1'], ['task', 't1']]);
  });
  it('sans child_id connu, invalide toutes les listes de tâches', () => {
    expect(invalidationsFor('tasks', null)).toEqual([['tasks']]);
  });
  it('points et demandes invalident le solde de l’enfant', () => {
    expect(invalidationsFor('point_transactions', { child_id: 'c1' })).toContainEqual(['balance', 'c1']);
    expect(invalidationsFor('reward_requests', { child_id: 'c1' })).toContainEqual(['balance', 'c1']);
  });
  it('couvre toutes les tables publiées', () => {
    for (const table of REALTIME_TABLES) expect(invalidationsFor(table, { child_id: 'c1' }).length).toBeGreaterThan(0);
  });
});

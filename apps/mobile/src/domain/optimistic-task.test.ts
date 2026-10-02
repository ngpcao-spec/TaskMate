import { dateInRange, optimisticTask } from './optimistic-task';

describe('optimisticTask', () => {
  it('complète les champs gérés par le serveur', () => {
    const t = optimisticTask(
      { id: 't1', child_id: 'c1', title: 'x', category: 'study', note: null, date: '2026-07-02', time_kind: 'anytime', start_time: null, end_time: null, points: 10 },
      { familyId: 'f1', memberId: 'm1', nowIso: '2026-07-02T01:00:00Z' },
    );
    expect(t).toMatchObject({ family_id: 'f1', created_by: 'm1', completed_at: null, deleted_at: null, recurrence_id: null });
  });
  it('dateInRange est inclusif', () => {
    expect(dateInRange('2026-07-02', '2026-07-02', '2026-07-02')).toBe(true);
    expect(dateInRange('2026-07-03', '2026-07-02', '2026-07-02')).toBe(false);
  });
});

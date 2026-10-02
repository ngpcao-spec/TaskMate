import { groupPendingByChild } from './approvals';

const t = (id: string, child: string, date: string, completed: string, points = 10) => ({ id, child_id: child, date, completed_at: completed, points });

describe('groupPendingByChild', () => {
  const tasks = [
    t('a', 'khang', '2026-07-02', '2026-07-02T11:00:00Z', 5),
    t('b', 'minh', '2026-07-02', '2026-07-02T09:00:00Z'),
    t('c', 'minh', '2026-06-30', '2026-06-30T20:00:00Z', 20),
    t('d', 'minh', '2026-07-02', '2026-07-02T08:00:00Z'),
  ];
  it('groupe par enfant dans l’ordre de la famille, puis par jour, plus anciens d’abord', () => {
    const g = groupPendingByChild(tasks, ['minh', 'khang']);
    expect(g.map((x) => x.childId)).toEqual(['minh', 'khang']);
    expect(g[0]?.days.map((d) => d.date)).toEqual(['2026-06-30', '2026-07-02']);
    expect(g[0]?.days[1]?.tasks.map((x) => x.id)).toEqual(['d', 'b']); // heure de coche croissante
  });
  it('compte et somme les points par enfant (pour « Duyệt tất cả »)', () => {
    const g = groupPendingByChild(tasks, ['minh', 'khang']);
    expect(g[0]).toMatchObject({ count: 3, totalPoints: 40 });
    expect(g[1]).toMatchObject({ count: 1, totalPoints: 5 });
  });
  it('ignore les enfants sans tâche en attente ; garde les enfants inconnus à la fin', () => {
    expect(groupPendingByChild([t('x', 'khang', '2026-07-02', 'z')], ['minh', 'khang']).map((x) => x.childId)).toEqual(['khang']);
    expect(groupPendingByChild([t('x', 'autre', '2026-07-02', 'z')], ['minh']).map((x) => x.childId)).toEqual(['autre']);
  });
  it('liste vide', () => expect(groupPendingByChild([], ['minh'])).toEqual([]));
});

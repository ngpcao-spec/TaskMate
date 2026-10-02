export type PendingTask = { id: string; child_id: string; date: string; completed_at: string | null; points: number };

export type ChildApprovals<T extends PendingTask> = {
  childId: string;
  count: number;
  totalPoints: number;
  days: { date: string; tasks: T[] }[];
};

/**
 * File « Cần duyệt » (SPEC §3.10) : tâches cochées non validées, groupées par enfant (ordre de la famille)
 * puis par jour, les plus anciennes d'abord. Une tâche en attente n'expire jamais.
 */
export function groupPendingByChild<T extends PendingTask>(tasks: readonly T[], childOrder: readonly string[]): ChildApprovals<T>[] {
  const byChild = new Map<string, T[]>();
  for (const t of tasks) byChild.set(t.child_id, [...(byChild.get(t.child_id) ?? []), t]);
  const ids = [...childOrder.filter((id) => byChild.has(id)), ...[...byChild.keys()].filter((id) => !childOrder.includes(id))];
  return ids.map((childId) => {
    const list = [...(byChild.get(childId) ?? [])].sort((a, b) => a.date.localeCompare(b.date) || (a.completed_at ?? '').localeCompare(b.completed_at ?? ''));
    const days: { date: string; tasks: T[] }[] = [];
    for (const t of list) {
      const last = days[days.length - 1];
      if (last && last.date === t.date) last.tasks.push(t);
      else days.push({ date: t.date, tasks: [t] });
    }
    return { childId, count: list.length, totalPoints: list.reduce((s, t) => s + t.points, 0), days };
  });
}

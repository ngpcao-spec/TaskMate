import { isOverdue, type TimedTask } from './task-time';

export type TaskFilter = 'upcoming' | 'done' | 'overdue';

type Filterable = TimedTask & { title: string };

/**
 * « Danh sách việc » (SPEC §3.5) : à venir (non faites, pas en retard), faites, en retard ; recherche par titre
 * (insensible à la casse et aux accents).
 */
export function filterTasks<T extends Filterable>(
  tasks: readonly T[],
  filter: TaskFilter,
  query: string,
  today: string,
  nowTime: string,
): T[] {
  const q = normalize(query);
  return tasks
    .filter((t) => {
      const done = t.completed_at !== null;
      const overdue = isOverdue(t, today, nowTime);
      if (filter === 'done') return done;
      if (filter === 'overdue') return overdue;
      return !done && !overdue;
    })
    .filter((t) => q === '' || normalize(t.title).includes(q))
    .sort((a, b) => (filter === 'done' || filter === 'overdue' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)));
}

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

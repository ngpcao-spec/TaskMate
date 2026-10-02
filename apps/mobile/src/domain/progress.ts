export type DayProgress = { done: number; total: number; ratio: number };

/** Progression d'un ensemble de tâches ; ratio 0 si vide (jamais NaN). */
export function dayProgress(tasks: readonly { completed_at: string | null }[]): DayProgress {
  const total = tasks.length;
  const done = tasks.filter((t) => t.completed_at !== null).length;
  return { done, total, ratio: total === 0 ? 0 : done / total };
}

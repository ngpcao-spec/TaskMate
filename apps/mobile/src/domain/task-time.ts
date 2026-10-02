import type { TimeKind } from '@/types/db';

/** Sous-ensemble d'une tâche nécessaire aux calculs d'horaire (heures `HH:MM[:SS]`). */
export type TimedTask = {
  date: string;
  time_kind: TimeKind;
  start_time: string | null;
  end_time: string | null;
  completed_at: string | null;
};

const hhmm = (t: string | null): string => (t ? t.slice(0, 5) : '');

/** Heure servant au tri : début pour `range`, échéance pour `deadline`, sinon aucune. */
export function sortTime(task: Pick<TimedTask, 'time_kind' | 'start_time' | 'end_time'>): string | null {
  if (task.time_kind === 'range') return hhmm(task.start_time);
  if (task.time_kind === 'deadline') return hhmm(task.end_time);
  return null;
}

/** Trié par heure de début (ou d'échéance) ; sans heure en dernier ; stable ensuite par titre. */
export function sortTasks<T extends Pick<TimedTask, 'time_kind' | 'start_time' | 'end_time'> & { title: string }>(
  tasks: readonly T[],
): T[] {
  return [...tasks].sort((a, b) => {
    const ta = sortTime(a);
    const tb = sortTime(b);
    if (ta === null && tb === null) return a.title.localeCompare(b.title);
    if (ta === null) return 1;
    if (tb === null) return -1;
    return ta === tb ? a.title.localeCompare(b.title) : ta < tb ? -1 : 1;
  });
}

export type TimeLabel =
  | { kind: 'range'; start: string; end: string }
  | { kind: 'deadline'; end: string }
  | { kind: 'anytime' };

export function timeLabel(task: Pick<TimedTask, 'time_kind' | 'start_time' | 'end_time'>): TimeLabel {
  if (task.time_kind === 'range') return { kind: 'range', start: hhmm(task.start_time), end: hhmm(task.end_time) };
  if (task.time_kind === 'deadline') return { kind: 'deadline', end: hhmm(task.end_time) };
  return { kind: 'anytime' };
}

/**
 * Tâche en retard (SPEC §5.5) : non faite et `date` passée, ou aujourd'hui avec `end_time` dépassé.
 * `today` = jour local de la famille (`YYYY-MM-DD`), `nowTime` = heure locale `HH:MM`.
 */
export function isOverdue(task: TimedTask, today: string, nowTime: string): boolean {
  if (task.completed_at !== null) return false;
  if (task.date < today) return true;
  if (task.date > today) return false;
  return task.end_time !== null && hhmm(task.end_time) < nowTime;
}

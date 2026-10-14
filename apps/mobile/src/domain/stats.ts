import { addDays, endOfMonth, format, parseISO, startOfMonth } from 'date-fns';
import { TASK_CATEGORIES, type TaskCategory } from '@/theme/categories';
import { weekDays } from './calendar';

export type StatsPeriod = 'week' | 'month';

/** Bornes `[from, to]` (`YYYY-MM-DD`) : semaine lundi → dimanche, ou mois civil — dans le fuseau famille (`today` en est issu). */
export function periodRange(period: StatsPeriod, today: string): { from: string; to: string } {
  if (period === 'week') {
    const days = weekDays(today);
    return { from: days[0] as string, to: days[6] as string };
  }
  const d = parseISO(today);
  return { from: format(startOfMonth(d), 'yyyy-MM-dd'), to: format(endOfMonth(d), 'yyyy-MM-dd') };
}

type StatTask = { date: string; category: TaskCategory; completed_at: string | null; deleted_at?: string | null };

export type CategoryShare = { category: TaskCategory; count: number; percent: number };
export type Stats = {
  total: number;
  done: number;
  notDone: number;
  /** Taux arrondi en %, ou `null` si la période est vide (affiché « — », jamais « NaN % »). */
  rate: number | null;
  byCategory: CategoryShare[];
};

/**
 * SPEC §5.4 — Total = tâches non supprimées dont `date` est dans la période ; Hoàn thành = celles avec `completed_at` ;
 * Chưa hoàn thành = différence ; taux = fait / total arrondi ; répartition = nb de la catégorie / total.
 */
export function computeStats(tasks: readonly StatTask[], from: string, to: string): Stats {
  const inPeriod = tasks.filter((t) => !t.deleted_at && t.date >= from && t.date <= to);
  const total = inPeriod.length;
  const done = inPeriod.filter((t) => t.completed_at !== null).length;
  const byCategory = TASK_CATEGORIES.map((category) => {
    const count = inPeriod.filter((t) => t.category === category).length;
    return { category, count, percent: total === 0 ? 0 : Math.round((count / total) * 100) };
  });
  return { total, done, notDone: total - done, rate: total === 0 ? null : Math.round((done / total) * 100), byCategory };
}

export type Encouragement = 'excellent' | 'good' | 'keepGoing';

/** ≥ 80 % « Xuất sắc! » ; 50–79 % « Làm tốt lắm!… » ; < 50 % « Cố lên… » ; aucune carte si période vide. */
export function encouragementFor(rate: number | null): Encouragement | null {
  if (rate === null) return null;
  if (rate >= 80) return 'excellent';
  if (rate >= 50) return 'good';
  return 'keepGoing';
}

export const formatRate = (rate: number | null): string => (rate === null ? '—' : `${rate}%`);

export type Bucket = { from: string; to: string; done: number; total: number };

/**
 * Barres du graphique « vue d'ensemble » : une barre par JOUR pour la semaine, une par SEMAINE (lundi → dimanche, bornée au mois) pour le mois.
 * Mêmes règles que `computeStats` (tâches supprimées exclues, `completed_at` = faite) ; 100 % local, jamais de NaN.
 */
export function completionBuckets(tasks: readonly StatTask[], period: StatsPeriod, from: string, to: string): Bucket[] {
  const inPeriod = tasks.filter((t) => !t.deleted_at && t.date >= from && t.date <= to);
  const ranges: { from: string; to: string }[] = [];
  if (period === 'week') {
    for (let d = parseISO(from); format(d, 'yyyy-MM-dd') <= to; d = addDays(d, 1)) {
      const day = format(d, 'yyyy-MM-dd');
      ranges.push({ from: day, to: day });
    }
  } else {
    let start = from;
    while (start <= to) {
      const week = weekDays(start);
      const end = (week[6] as string) < to ? (week[6] as string) : to;
      ranges.push({ from: start, to: end });
      start = format(addDays(parseISO(end), 1), 'yyyy-MM-dd');
    }
  }
  return ranges.map((r) => {
    const inside = inPeriod.filter((t) => t.date >= r.from && t.date <= r.to);
    return { ...r, total: inside.length, done: inside.filter((t) => t.completed_at !== null).length };
  });
}

import { shiftDay, weekDays } from '@/domain/calendar';
import type { AttemptStatus } from '@/domain/quiz';

/**
 * « Révision de la semaine » dans Hôm nay (D-083) : calculs purs, SANS ligne dans `tasks`. Les dates sont des JOURS LOCAUX de la famille
 * (`YYYY-MM-DD`), « aujourd'hui » vient de `todayInTz`. Le serveur reste l'autorité (disponibilité, score, validation, points) ; le retard est une
 * INFORMATION : il ne bloque jamais l'enfant et ne coûte aucun point.
 */

export type WeeklyState = 'todo' | 'in_progress' | 'waiting' | 'validated';

/** Entrée neutre : bâtie par un adaptateur depuis la ligne enfant (`child_catalog_quizzes`) ou parent (`parent_catalog_overview`). */
export type WeeklyInput = {
  quizId: string;
  subject: string;
  title: string;
  weekLabel: string;
  /** Jour d'ouverture / date limite, déjà décalés par le parent (jours locaux). */
  releaseOn: string | null;
  dueOn: string | null;
  /** Dernière tentative de l'enfant (null = pas commencé). */
  attemptId: string | null;
  attemptStatus: AttemptStatus | null | undefined;
  answered: number;
  questionCount: number;
  /** Résultat : seulement exploité une fois la tentative VALIDÉE. */
  score: number | null;
  scoreTotal: number | null;
  /** Maximum du barème et points déjà rapportés par ce quiz : lus du SERVEUR (D-084), jamais recalculés ici. */
  maxPoints: number;
  pointsAwarded: number;
};

export type WeeklyItem = {
  quizId: string;
  subject: string;
  title: string;
  weekLabel: string;
  releaseOn: string | null;
  dueOn: string | null;
  attemptId: string | null;
  state: WeeklyState;
  /** Date limite passée et quiz pas encore envoyé (à faire ou en cours). Information seulement. */
  late: boolean;
  progress: { answered: number; total: number } | null;
  result: { score: number; total: number } | null;
  maxPoints: number;
  pointsAwarded: number;
};

/** Dernier jour d'affichage : le dimanche de la semaine qui SUIT la date limite. Sans date limite : repli sur le jour d'ouverture ; sans rien : null. */
export function lastVisibleDay(releaseOn: string | null, dueOn: string | null): string | null {
  const base = dueOn ?? releaseOn;
  return base ? (weekDays(shiftDay(base, 7))[6] as string) : null;
}

export const isLate = (dueOn: string | null, today: string, state: WeeklyState): boolean => !!dueOn && today > dueOn && (state === 'todo' || state === 'in_progress');

const stateOf = (status: AttemptStatus | null | undefined): WeeklyState =>
  status === 'validated' ? 'validated' : status === 'submitted' ? 'waiting' : status === 'in_progress' ? 'in_progress' : 'todo';

/**
 * Ligne affichable pour `today`, ou null si elle ne l'est pas : pas encore ouverte, ou terminée depuis la fin de la semaine qui suit la date limite.
 * Un quiz envoyé reste affiché tant que le parent n'a pas validé (il doit le voir), puis jusqu'à la même échéance.
 */
export function weeklyItem(i: WeeklyInput, today: string, windowed = true): WeeklyItem | null {
  if (!i.releaseOn || today < i.releaseOn) return null;
  const end = lastVisibleDay(i.releaseOn, i.dueOn);
  const state = stateOf(i.attemptStatus);
  if (windowed && end && today > end && state !== 'waiting') return null;
  const answered = Math.max(0, Math.min(i.answered, i.questionCount));
  return {
    quizId: i.quizId,
    subject: i.subject,
    title: i.title,
    weekLabel: i.weekLabel,
    releaseOn: i.releaseOn,
    dueOn: i.dueOn,
    attemptId: i.attemptId,
    state,
    late: isLate(i.dueOn, today, state),
    progress: state === 'in_progress' ? { answered, total: i.questionCount } : null,
    result: state === 'validated' && i.score !== null && i.scoreTotal !== null ? { score: i.score, total: i.scoreTotal } : null,
    maxPoints: i.maxPoints,
    pointsAwarded: state === 'validated' ? i.pointsAwarded : 0,
  };
}

const RANK: Record<WeeklyState, number> = { in_progress: 0, todo: 1, waiting: 2, validated: 3 };

/** Ordre stable : en cours, à faire (échéance la plus proche d'abord, donc les retards en tête), envoyés, validés. */
export function sortWeekly<T extends WeeklyItem>(items: readonly T[]): T[] {
  return [...items].sort(
    (a, b) =>
      RANK[a.state] - RANK[b.state] ||
      (a.dueOn ?? '9999-12-31').localeCompare(b.dueOn ?? '9999-12-31') ||
      a.subject.localeCompare(b.subject) ||
      a.title.localeCompare(b.title) ||
      a.quizId.localeCompare(b.quizId),
  );
}

/** Lignes affichables dans Hôm nay, triées. `windowed: false` (calendrier) : tous les quiz ouverts, y compris ceux dont la fenêtre d'affichage est close. */
export function visibleWeekly(inputs: readonly WeeklyInput[], today: string, windowed = true): WeeklyItem[] {
  return sortWeekly(inputs.map((i) => weeklyItem(i, today, windowed)).filter((x): x is WeeklyItem => x !== null));
}

// ───────────── adaptateurs (lignes serveur → entrée neutre) ─────────────
export type ChildWeeklyRow = {
  source: 'family' | 'catalog';
  set_id: string;
  subject_key: string | null;
  title: string;
  week_label: string | null;
  question_count: number;
  evaluation_attempt_id: string | null;
  evaluation_status: AttemptStatus | null;
  due_on: string | null;
  release_on: string | null;
  answered_count: number;
  score: number | null;
  total: number | null;
  max_points: number;
  points_awarded: number;
};
/** Côté enfant : seulement les quiz du CATALOGUE (les jeux importés par la famille restent dans « Révisions »). */
export const childWeeklyInputs = (rows: readonly ChildWeeklyRow[]): WeeklyInput[] =>
  rows
    .filter((r) => r.source === 'catalog')
    .map((r) => ({
      quizId: r.set_id, subject: r.subject_key ?? '', title: r.title, weekLabel: r.week_label ?? '', releaseOn: r.release_on, dueOn: r.due_on,
      attemptId: r.evaluation_attempt_id, attemptStatus: r.evaluation_status, answered: r.answered_count, questionCount: r.question_count, score: r.score, scoreTotal: r.total, maxPoints: r.max_points, pointsAwarded: r.points_awarded,
    }));

export type ParentWeeklyRow = {
  quiz_id: string;
  subject: string;
  week_label: string;
  title: string;
  question_count: number;
  release_on: string;
  due_on: string;
  available: boolean;
  attempt_id: string | null;
  attempt_status: AttemptStatus | null;
  answered_count: number;
  score: number | null;
  total: number | null;
  max_points: number;
  points_awarded: number;
};
export const parentWeeklyInputs = (rows: readonly ParentWeeklyRow[]): WeeklyInput[] =>
  rows
    .filter((r) => r.available)
    .map((r) => ({
      quizId: r.quiz_id, subject: r.subject, title: r.title, weekLabel: r.week_label, releaseOn: r.release_on, dueOn: r.due_on,
      attemptId: r.attempt_id, attemptStatus: r.attempt_status, answered: r.answered_count, questionCount: r.question_count, score: r.score, scoreTotal: r.total, maxPoints: r.max_points, pointsAwarded: r.points_awarded,
    }));

// ───────────── calendrier ─────────────
/** Quiz dont la date limite tombe dans `days` (jours locaux), regroupés par jour. Les quiz sans date limite n'ont pas de repère. */
export function dueByDay<T extends { dueOn: string | null }>(items: readonly T[], days: readonly string[]): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const day of days) out[day] = [];
  for (const item of items) if (item.dueOn && out[item.dueOn]) (out[item.dueOn] as T[]).push(item);
  return out;
}

/** Marqueurs de la semaine : jours portant au moins une date limite. */
export const dueMarkedDays = (byDay: Record<string, readonly unknown[]>): Set<string> => new Set(Object.keys(byDay).filter((d) => (byDay[d] ?? []).length > 0));

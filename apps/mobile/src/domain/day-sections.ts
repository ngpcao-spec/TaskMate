import { sortTasks, type TimedTask } from './task-time';

/**
 * Objectifs de la journée groupés par moment (interface V2, D-106), d'après l'heure LOCALE de la tâche (jamais un instant UTC) :
 * matin avant 12 h, après-midi de 12 h à 18 h, soir à partir de 18 h, « quand je veux » pour les tâches sans heure.
 * `range` → heure de début ; `deadline` → heure d'échéance.
 */
export const DAY_SECTIONS = ['morning', 'afternoon', 'evening', 'anytime'] as const;
export type DaySection = (typeof DAY_SECTIONS)[number];

export const AFTERNOON_FROM = 12;
export const EVENING_FROM = 18;

type Sectionable = Pick<TimedTask, 'time_kind' | 'start_time' | 'end_time'>;

const hourOf = (t: string | null): number | null => {
  if (!t) return null;
  const h = Number(t.slice(0, 2));
  return Number.isInteger(h) && h >= 0 && h <= 23 ? h : null;
};

export function daySectionOf(task: Sectionable): DaySection {
  const h = task.time_kind === 'range' ? hourOf(task.start_time) : task.time_kind === 'deadline' ? hourOf(task.end_time) : null;
  if (h === null) return 'anytime';
  return h < AFTERNOON_FROM ? 'morning' : h < EVENING_FROM ? 'afternoon' : 'evening';
}

export type DayGroup<T> = { section: DaySection; items: T[] };

/**
 * Groupes dans l'ordre de la journée, triés par heure dans chaque groupe ; groupes vides masqués. `anytimeExtra` = une ligne calculée ajoutée à
 * « quand je veux » (la révision de la semaine, D-084) : ce groupe s'affiche alors même sans tâche.
 */
export function groupByDaySection<T extends Sectionable & { title: string }>(tasks: readonly T[], anytimeExtra = false): DayGroup<T>[] {
  const sorted = sortTasks(tasks);
  return DAY_SECTIONS.map((section) => ({ section, items: sorted.filter((t) => daySectionOf(t) === section) })).filter(
    (g) => g.items.length > 0 || (anytimeExtra && g.section === 'anytime'),
  );
}

// ───────────── Fin de journée ─────────────

type Checkable = { completed_at: string | null };

/** Tâches qui restent à cocher aujourd'hui (une tâche cochée en attente de validation compte comme faite). */
export const remainingCount = (tasks: readonly Checkable[]): number => tasks.filter((t) => t.completed_at === null).length;

/** Journée finie : au moins une tâche prévue et toutes cochées. */
export const dayComplete = (tasks: readonly Checkable[]): boolean => tasks.length > 0 && remainingCount(tasks) === 0;

export type CelebrationAction = { kind: 'go' } | { kind: 'missing'; energy: number } | null;

/**
 * Bouton de la carte de fin de journée : « Đi phiêu lưu! » quand la jauge est pleine (départ toujours conditionné à la jauge, décision de Teo),
 * sinon « Còn {n} ⚡ nữa là đi được! » ; rien pendant un voyage ou au retour (la carte d'aventure s'en charge).
 */
export function celebrationAction(adventure: { state: 'filling' | 'ready_to_go' | 'away' | 'back'; gauge: number; cost: number } | null | undefined): CelebrationAction {
  if (!adventure) return null;
  if (adventure.state === 'ready_to_go') return { kind: 'go' };
  if (adventure.state === 'filling') return { kind: 'missing', energy: Math.max(1, adventure.cost - adventure.gauge) };
  return null;
}

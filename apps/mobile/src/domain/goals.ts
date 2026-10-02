import { z } from 'zod';

export const GOAL_ICONS = ['target', 'book-open', 'dumbbell', 'star', 'trophy', 'heart', 'music', 'bike'] as const;
export const MAX_GOAL_TARGET = 100_000;

export const goalFormSchema = z.object({
  title: z.string().trim().min(1, 'titleRequired').max(80, 'titleTooLong'),
  icon: z.enum(GOAL_ICONS),
  target: z.number().int('targetInvalid').min(1, 'targetInvalid').max(MAX_GOAL_TARGET, 'targetInvalid'),
  unit: z.string().trim().max(20, 'unitTooLong').optional(),
});
export type GoalFormValues = z.input<typeof goalFormSchema>;

/** Progression bornée à [0, +∞[ (la cible peut être dépassée : 6/5 reste atteint). */
export const clampProgress = (value: number): number => Math.max(0, Math.floor(value));

/** Ratio d'affichage de la barre, plafonné à 1. */
export const goalRatio = (progress: number, target: number): number => (target <= 0 ? 0 : Math.min(progress / target, 1));

export const isGoalAchieved = (progress: number, target: number): boolean => progress >= target;

/** Passe-t-on de « pas atteint » à « atteint » avec ce changement ? (déclenche badge + toast) */
export const justAchieved = (before: number, after: number, target: number): boolean =>
  before < target && after >= target;

/** « 3/5 » ou « 4/12 km ». */
export function formatGoalProgress(progress: number, target: number, unit?: string | null): string {
  const base = `${progress}/${target}`;
  return unit && unit.trim() ? `${base} ${unit.trim()}` : base;
}

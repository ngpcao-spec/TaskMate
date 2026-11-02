import type { TaskCategory } from '@/types/models';

/**
 * Icônes d'objectifs (D-106) : liste FERMÉE de 36 slugs, identique à `goal_icon_slugs()` côté SQL et aux images `assets/v2/goals/goal-<slug>.webp`.
 * Une tâche sans icône prend celle de sa catégorie.
 */
export const GOAL_ICONS = [
  'reveil', 'brosse-a-dents', 'savon', 'douche', 'vetements', 'lit',
  'petit-dejeuner', 'boite-repas', 'diner', 'verre-eau', 'fruits', 'cartable',
  'devoirs', 'lecture', 'ecriture', 'maths', 'langues', 'dessin',
  'piano', 'football', 'natation', 'velo', 'course', 'yoga',
  'ranger', 'vaisselle', 'linge', 'poubelle', 'arroser', 'animal',
  'cuisiner', 'appeler', 'gentillesse', 'dormir-tot', 'sans-ecran', 'calme',
] as const;
export type GoalIcon = (typeof GOAL_ICONS)[number];

export const isGoalIcon = (v: unknown): v is GoalIcon => typeof v === 'string' && (GOAL_ICONS as readonly string[]).includes(v);

/** Icône par défaut de chaque catégorie. */
export const CATEGORY_ICON: Record<TaskCategory, GoalIcon> = {
  study: 'devoirs',
  sport: 'course',
  chores: 'ranger',
  personal: 'brosse-a-dents',
  other: 'reveil',
};

/** Icône affichée : celle de la tâche (ou de la récurrence) si elle est valide, sinon celle de la catégorie. */
export function goalIconFor(item: { icon?: string | null; category?: string | null }): GoalIcon {
  if (isGoalIcon(item.icon)) return item.icon;
  const cat = item.category as TaskCategory | undefined;
  return cat && cat in CATEGORY_ICON ? CATEGORY_ICON[cat] : CATEGORY_ICON.other;
}

/** Icône de la ligne « Révision de la semaine » (D-084) dans la V2. */
export const WEEKLY_REVIEW_ICON: GoalIcon = 'devoirs';

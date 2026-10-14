import { theme } from './index';

export const TASK_CATEGORIES = ['study', 'sport', 'chores', 'personal', 'other'] as const;
export type TaskCategory = (typeof TASK_CATEGORIES)[number];

export const CATEGORY_COLORS: Record<TaskCategory, string> = theme.categoryColors;

/** lucide icon names, resolved in components. */
export const CATEGORY_ICONS: Record<TaskCategory, string> = {
  study: 'BookOpen',
  sport: 'Dumbbell',
  chores: 'House',
  personal: 'User',
  other: 'Ellipsis',
};

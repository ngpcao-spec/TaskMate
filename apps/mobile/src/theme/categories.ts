export const TASK_CATEGORIES = ['study', 'sport', 'chores', 'personal', 'other'] as const;
export type TaskCategory = (typeof TASK_CATEGORIES)[number];

export const CATEGORY_COLORS: Record<TaskCategory, string> = {
  study: '#2F80ED',
  sport: '#8B5CF6',
  chores: '#F5A623',
  personal: '#27AE60',
  other: '#94A3B8',
};

/** lucide icon names, resolved in components. */
export const CATEGORY_ICONS: Record<TaskCategory, string> = {
  study: 'BookOpen',
  sport: 'Dumbbell',
  chores: 'House',
  personal: 'User',
  other: 'Ellipsis',
};

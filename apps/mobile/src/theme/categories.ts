export const TASK_CATEGORIES = ['study', 'sport', 'chores', 'personal', 'other'] as const;
export type TaskCategory = (typeof TASK_CATEGORIES)[number];

export const CATEGORY_COLORS: Record<TaskCategory, string> = {
  study: '#3A7CA5',
  sport: '#7C79C2',
  chores: '#C98E36',
  personal: '#3A9A84',
  other: '#7D93A6',
};

/** lucide icon names, resolved in components. */
export const CATEGORY_ICONS: Record<TaskCategory, string> = {
  study: 'BookOpen',
  sport: 'Dumbbell',
  chores: 'House',
  personal: 'User',
  other: 'Ellipsis',
};

export const queryKeys = {
  me: ['me'] as const,
  children: (familyId: string) => ['children', familyId] as const,
};

export const taskKeys = {
  all: (childId: string) => ['tasks', childId] as const,
  range: (childId: string, from: string, to: string) => ['tasks', childId, from, to] as const,
  one: (taskId: string) => ['task', taskId] as const,
};

// Clés réservées aux jalons suivants (invalidées dès maintenant par le Realtime).
export const balanceKeys = { child: (childId: string) => ['balance', childId] as const };

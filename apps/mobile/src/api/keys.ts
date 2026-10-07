export const queryKeys = {
  me: ['me'] as const,
  children: (familyId: string) => ['children', familyId] as const,
};

export const taskKeys = {
  all: (childId: string) => ['tasks', childId] as const,
  range: (childId: string, from: string, to: string) => ['tasks', childId, from, to] as const,
  one: (taskId: string) => ['task', taskId] as const,
  /** File « Cần duyệt » : tâches cochées non validées de toute la famille. */
  pending: ['tasks', 'pending'] as const,
};

// Clés réservées aux jalons suivants (invalidées dès maintenant par le Realtime).
export const balanceKeys = { child: (childId: string) => ['balance', childId] as const };

/** Révisions (D-055). Tout sous ['quiz'] : le Realtime (quiz_sets, quiz_attempts) invalide par ce préfixe. */
export const quizKeys = {
  all: ['quiz'] as const,
  sets: (childId: string | null) => ['quiz', 'sets', childId ?? 'all'] as const,
  set: (setId: string) => ['quiz', 'set', setId] as const,
  questions: (setId: string) => ['quiz', 'questions', setId] as const,
  attempts: (setId: string) => ['quiz', 'attempts', setId] as const,
  childAttempts: (childId: string) => ['quiz', 'child-attempts', childId] as const,
  pending: ['quiz', 'pending'] as const,
  detail: (attemptId: string) => ['quiz', 'detail', attemptId] as const,
  // côté enfant
  mine: ['quiz', 'mine'] as const,
  play: (setId: string) => ['quiz', 'play', setId] as const,
  result: (attemptId: string) => ['quiz', 'result', attemptId] as const,
  history: (setId: string) => ['quiz', 'history', setId] as const,
};

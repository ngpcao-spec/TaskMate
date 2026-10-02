/** État dérivé d'une tâche (SPEC v4 §4.2) : à faire | cochée en attente de validation | validée. */
export type TaskState = 'todo' | 'pending' | 'validated';

export type StatefulTask = { completed_at: string | null; validated_at: string | null };

export function taskState(task: StatefulTask): TaskState {
  if (task.completed_at === null) return 'todo';
  return task.validated_at === null ? 'pending' : 'validated';
}

/**
 * Valeurs de coche appliquées de façon optimiste au cache. L'ENFANT ne crédite jamais rien (la tâche passe `pending`) ;
 * seul un parent valide d'office (SPEC §5.2).
 */
export function optimisticToggle(
  task: StatefulTask,
  completed: boolean,
  asParent: boolean,
  nowIso: string,
): { completed_at: string | null; validated_at: string | null; rejection_note?: null; rejected_at?: null } {
  if (!completed) return { completed_at: null, validated_at: null };
  return {
    completed_at: nowIso,
    validated_at: asParent ? nowIso : null,
    rejection_note: null,
    rejected_at: null,
  };
}

/** Points effectivement mouvementés par une action de PARENT sur une tâche (pour le solde projeté hors ligne). */
export function parentPointsDelta(
  action: 'toggle-on' | 'toggle-off' | 'validate',
  task: StatefulTask & { points: number },
): number {
  if (action === 'toggle-on') return task.completed_at === null ? task.points : 0;
  if (action === 'validate') return taskState(task) === 'pending' ? task.points : 0;
  return taskState(task) === 'validated' ? -task.points : 0;
}

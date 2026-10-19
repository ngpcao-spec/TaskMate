/** Données embarquées dans une notification (push ou locale). */
export type NotificationData = { type?: string; requestId?: string; taskId?: string; childId?: string; quizId?: string; attemptId?: string };

export type NotificationIntent =
  | { kind: 'approve'; requestId: string }
  | { kind: 'reject'; requestId: string }
  | { kind: 'validate_task'; taskId: string }
  | { kind: 'reject_task'; taskId: string }
  | { kind: 'navigate'; href: '/more/points' | '/(tabs)/today' | '/more/goals' | '/notifications' | '/approvals' | '/weekly' | `/quiz/detail?${string}` }
  | { kind: 'none' };

export const ACTION_APPROVE = 'approve';
export const ACTION_REJECT = 'reject';
export const CATEGORY_REWARD_REQUEST = 'reward_request';
/** Notification « tâche cochée à valider » : mêmes boutons Duyệt / Từ chối (SPEC §5.6). */
export const CATEGORY_TASK_VALIDATION = 'task_validation';

/** Réponse de l'utilisateur à une notification → action métier (boutons Approuver/Refuser, SPEC §3.7) ou navigation. */
export function intentFor(actionIdentifier: string, data: NotificationData): NotificationIntent {
  if (data.type === 'task_completed' && data.taskId) {
    if (actionIdentifier === ACTION_APPROVE) return { kind: 'validate_task', taskId: data.taskId };
    if (actionIdentifier === ACTION_REJECT) return { kind: 'reject_task', taskId: data.taskId };
  }
  if (actionIdentifier === ACTION_APPROVE && data.requestId) return { kind: 'approve', requestId: data.requestId };
  if (actionIdentifier === ACTION_REJECT && data.requestId) return { kind: 'reject', requestId: data.requestId };
  switch (data.type) {
    case 'task_completed':
      return { kind: 'navigate', href: '/approvals' };
    case 'reward_requested':
    case 'reward_approved':
    case 'reward_rejected':
    case 'reward_expired':
    case 'points_adjusted':
      return { kind: 'navigate', href: '/more/points' };
    case 'goal_achieved':
      return { kind: 'navigate', href: '/more/goals' };
    case 'quiz_submitted': {
      // D-089 : le parent ouvre le DÉTAIL de ce quiz (il y valide) ; sans identifiants (ancienne notification), l'écran Ôn tập
      if (!data.childId || !data.quizId) return { kind: 'navigate', href: '/weekly' };
      const attempt = data.attemptId ? `&attempt=${encodeURIComponent(data.attemptId)}` : '';
      return { kind: 'navigate', href: `/quiz/detail?child=${encodeURIComponent(data.childId)}&quiz=${encodeURIComponent(data.quizId)}${attempt}` };
    }
    case 'quiz_validated': // l'enfant ouvre la validation de son quiz (D-088)
      return { kind: 'navigate', href: '/weekly' };
    case 'task_assigned':
    case 'task_validated':
    case 'task_rejected':
    case 'reminder_start':
    case 'reminder_deadline':
    case 'evening_recap':
      return { kind: 'navigate', href: '/(tabs)/today' };
    default:
      return { kind: 'none' };
  }
}

/** Données embarquées dans une notification (push ou locale). */
export type NotificationData = { type?: string; requestId?: string; taskId?: string; childId?: string };

export type NotificationIntent =
  | { kind: 'approve'; requestId: string }
  | { kind: 'reject'; requestId: string }
  | { kind: 'navigate'; href: '/more/points' | '/(tabs)/today' | '/more/goals' | '/notifications' }
  | { kind: 'none' };

export const ACTION_APPROVE = 'approve';
export const ACTION_REJECT = 'reject';
export const CATEGORY_REWARD_REQUEST = 'reward_request';

/** Réponse de l'utilisateur à une notification → action métier (boutons Approuver/Refuser, SPEC §3.7) ou navigation. */
export function intentFor(actionIdentifier: string, data: NotificationData): NotificationIntent {
  if (actionIdentifier === ACTION_APPROVE && data.requestId) return { kind: 'approve', requestId: data.requestId };
  if (actionIdentifier === ACTION_REJECT && data.requestId) return { kind: 'reject', requestId: data.requestId };
  switch (data.type) {
    case 'reward_requested':
    case 'reward_approved':
    case 'reward_rejected':
    case 'reward_expired':
    case 'points_adjusted':
      return { kind: 'navigate', href: '/more/points' };
    case 'goal_achieved':
      return { kind: 'navigate', href: '/more/goals' };
    case 'task_assigned':
    case 'task_completed':
    case 'reminder_start':
    case 'reminder_deadline':
    case 'evening_recap':
      return { kind: 'navigate', href: '/(tabs)/today' };
    default:
      return { kind: 'none' };
  }
}

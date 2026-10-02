import { approveRewardRequest, rejectRewardRequest } from '@/api/points';
import { newId } from '@/api/ids';
import { rejectTaskRpc, validateTaskRpc } from '@/api/tasks';
import { intentFor, type NotificationData, type NotificationIntent } from '@/domain/notification-actions';
import type { PlannedReminder } from '@/domain/reminders';
import i18n from '@/i18n';

/**
 * Version web : pas d'expo-notifications. Les rappels locaux planifiés n'existent pas dans un navigateur ;
 * le centre de notifications intégré (écran /notifications) est le canal principal, Web Push en option (lot W3).
 */
export function formatReminder(r: PlannedReminder): { title: string; body: string; data: NotificationData } {
  switch (r.kind) {
    case 'start':
      return { title: r.title, body: i18n.t('notifications.reminderStart', { minutes: r.minutes, time: r.time }), data: { type: 'reminder_start', taskId: r.taskId } };
    case 'deadline':
      return { title: r.title, body: i18n.t('notifications.reminderDeadline', { minutes: r.minutes, time: r.time }), data: { type: 'reminder_deadline', taskId: r.taskId } };
    case 'recap':
      return { title: i18n.t('notifications.recapTitle'), body: i18n.t('notifications.recapBody', { count: r.count }), data: { type: 'evening_recap' } };
  }
}

export async function syncLocalReminders(_planned: readonly PlannedReminder[]): Promise<void> {}
export async function cancelAllLocalReminders(): Promise<void> {}
export async function configureNotifications(): Promise<void> {}
export async function ensureNotificationPermission(): Promise<boolean> {
  return false;
}
export async function registerPushToken(): Promise<boolean> {
  return false;
}

export type ResponseDeps = {
  approve: (requestId: string) => Promise<void>;
  reject: (requestId: string) => Promise<void>;
  validateTask: (taskId: string) => Promise<void>;
  rejectTask: (taskId: string) => Promise<void>;
  navigate: (href: Extract<NotificationIntent, { kind: 'navigate' }>['href']) => void;
};

/** Même logique que sur mobile (tap/bouton d'une notification → RPC ou navigation) ; utilisée par le Web Push (W3). */
export async function handleNotificationResponse(
  response: { actionIdentifier: string; notification: { request: { content: { data?: unknown } } } },
  deps: ResponseDeps = {
    approve: (id) => approveRewardRequest(id),
    reject: (id) => rejectRewardRequest(id),
    validateTask: (id) => validateTaskRpc(id, newId()),
    rejectTask: (id) => rejectTaskRpc(id),
    navigate: () => undefined,
  },
): Promise<NotificationIntent> {
  const data = (response.notification.request.content.data ?? {}) as NotificationData;
  const intent = intentFor(response.actionIdentifier, data);
  if (intent.kind === 'approve') await deps.approve(intent.requestId);
  else if (intent.kind === 'reject') await deps.reject(intent.requestId);
  else if (intent.kind === 'validate_task') await deps.validateTask(intent.taskId);
  else if (intent.kind === 'reject_task') await deps.rejectTask(intent.taskId);
  else if (intent.kind === 'navigate') deps.navigate(intent.href);
  return intent;
}

export function subscribeToResponses(_handler: (r: Parameters<typeof handleNotificationResponse>[0]) => void): () => void {
  return () => undefined;
}

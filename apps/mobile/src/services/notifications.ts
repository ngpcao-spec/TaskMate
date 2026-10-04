import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { registerDevice } from '@/api/notifications';
import { approveRewardRequest, rejectRewardRequest } from '@/api/points';
import { newId } from '@/api/ids';
import { rejectTaskRpc, validateTaskRpc } from '@/api/tasks';
import {
  ACTION_APPROVE,
  ACTION_REJECT,
  CATEGORY_REWARD_REQUEST,
  CATEGORY_TASK_VALIDATION,
  intentFor,
  type NotificationData,
  type NotificationIntent,
} from '@/domain/notification-actions';
import { diffSchedule, type PlannedReminder } from '@/domain/reminders';
import i18n from '@/i18n';

/** Texte d'un rappel local (i18n : vi par défaut). */
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

/**
 * Replanifie les rappels locaux : annule ceux qui ne sont plus voulus (tâche cochée/supprimée/déplacée),
 * (re)planifie les autres sous un identifiant stable → jamais de doublon (SPEC §5.6).
 */
export async function syncLocalReminders(planned: readonly PlannedReminder[]): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const ours = scheduled.map((n) => n.identifier).filter((id) => id.startsWith('task:') || id.startsWith('recap:'));
  const { cancel } = diffSchedule(ours, planned);
  await Promise.all(cancel.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
  for (const r of planned) {
    const { title, body, data } = formatReminder(r);
    await Notifications.scheduleNotificationAsync({
      identifier: r.id,
      content: { title, body, data },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.at, channelId: 'default' },
    });
  }
}

export async function cancelAllLocalReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/** Handler foreground + catégorie « demande d'échange » avec actions Approuver / Refuser (SPEC §3.7). */
export async function configureNotifications(): Promise<void> {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', { name: 'TaskMate', importance: Notifications.AndroidImportance.DEFAULT });
  }
  await Notifications.setNotificationCategoryAsync(CATEGORY_TASK_VALIDATION, [
    { identifier: ACTION_APPROVE, buttonTitle: i18n.t('approvals.approve'), options: { opensAppToForeground: false } },
    { identifier: ACTION_REJECT, buttonTitle: i18n.t('approvals.reject'), options: { opensAppToForeground: false, isDestructive: true } },
  ]);
  await Notifications.setNotificationCategoryAsync(CATEGORY_REWARD_REQUEST, [
    { identifier: ACTION_APPROVE, buttonTitle: i18n.t('points.approve'), options: { opensAppToForeground: false } },
    { identifier: ACTION_REJECT, buttonTitle: i18n.t('points.reject'), options: { opensAppToForeground: false, isDestructive: true } },
  ]);
}

export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/** Enregistre le jeton Expo Push de cet appareil (nécessite un projectId EAS — HUMAN_TODO). Renvoie false si impossible. */
export async function registerPushToken(): Promise<boolean> {
  const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
  if (!projectId) return false;
  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
  await registerDevice(data, Platform.OS === 'ios' ? 'ios' : 'android');
  return true;
}

export type ResponseDeps = {
  approve: (requestId: string) => Promise<void>;
  reject: (requestId: string) => Promise<void>;
  validateTask: (taskId: string) => Promise<void>;
  rejectTask: (taskId: string) => Promise<void>;
  navigate: (href: Extract<NotificationIntent, { kind: 'navigate' }>['href']) => void;
};

/** Traite le tap / le bouton d'une notification. Les actions Approuver/Refuser appellent directement les RPC. */
export async function handleNotificationResponse(
  response: { actionIdentifier: string; notification: { request: { content: { data?: unknown } } } },
  deps: ResponseDeps = {
    approve: (id) => approveRewardRequest(id),
    reject: (id) => rejectRewardRequest(id),
    // le tx_id est tiré une fois par action : un rejeu (retry) ne crédite jamais deux fois
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

type NotificationResponse = Parameters<typeof handleNotificationResponse>[0];

/** Abonne un handler aux taps/boutons de notification (+ démarrage à froid). Renvoie la fonction de désabonnement. */
export function subscribeToResponses(handler: (r: NotificationResponse) => void): () => void {
  let active = true;
  const sub = Notifications.addNotificationResponseReceivedListener(handler);
  void Notifications.getLastNotificationResponseAsync().then((r) => {
    if (r && active) handler(r);
  });
  return () => {
    active = false;
    sub.remove();
  };
}

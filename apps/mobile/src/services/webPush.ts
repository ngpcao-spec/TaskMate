import type { WebPushAvailability } from '@/domain/web-push';

/** Statut Web Push d'un navigateur. Natif : toujours « non supporté » (les push natifs passent par expo-notifications). */
export type WebPushStatus = WebPushAvailability | 'off' | 'on';

export async function getWebPushStatus(): Promise<WebPushStatus> {
  return 'unsupported';
}
export async function enableWebPush(): Promise<'on' | 'denied' | 'failed'> {
  return 'failed';
}
export async function disableWebPush(): Promise<void> {}

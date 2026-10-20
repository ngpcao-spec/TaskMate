import { fetchPushStatus } from '@/api/notifications';
import type { EnableResult, TestOutcome, WebPushAvailability } from '@/domain/web-push';

/** Statut Web Push d'un navigateur. Natif : toujours « non supporté » (les push natifs passent par expo-notifications). */
export type WebPushStatus = WebPushAvailability | 'off' | 'on' | 'unsynced' | 'unverified';

export async function getWebPushStatus(): Promise<WebPushStatus> {
  return 'unsupported';
}
export async function enableWebPush(): Promise<EnableResult> {
  return { ok: false, reason: 'unsupported' };
}
export async function disableWebPush(): Promise<void> {}
export async function sendTestNotification(): Promise<TestOutcome> {
  return { kind: 'error', code: null };
}

/** Natif : l'appareil est enregistré quand le membre a au moins un appareil actif en base (jeton d'`expo-notifications`). */
export async function thisDeviceRegistered(): Promise<boolean> {
  return ((await fetchPushStatus(null))?.activeDevices ?? 0) > 0;
}

/** Natif : aucune installation à demander (l'app est déjà installée). */
export function installState(): { ios: boolean; standalone: boolean } {
  return { ios: false, standalone: true };
}

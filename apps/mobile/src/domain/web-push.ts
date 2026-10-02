/** Logique pure du Web Push côté client (W3) — testable sans navigateur. */

export type WebPushEnv = {
  hasServiceWorker: boolean;
  hasPushManager: boolean;
  hasNotification: boolean;
  isIos: boolean;
  /** PWA lancée depuis l'écran d'accueil (display-mode: standalone / navigator.standalone). */
  isStandalone: boolean;
  vapidKey: string;
  permission: 'default' | 'granted' | 'denied';
};

export type WebPushAvailability = 'unsupported' | 'needs-install' | 'not-configured' | 'denied' | 'ready';

/**
 * Sur iOS (≥ 16.4), le Web Push n'existe que pour une PWA installée sur l'écran d'accueil :
 * dans un onglet Safari, `PushManager` est absent → on guide l'utilisateur vers l'installation.
 */
export function webPushAvailability(env: WebPushEnv): WebPushAvailability {
  if (env.isIos && !env.isStandalone) return 'needs-install';
  if (!env.hasServiceWorker || !env.hasPushManager || !env.hasNotification) return 'unsupported';
  if (!env.vapidKey) return 'not-configured';
  if (env.permission === 'denied') return 'denied';
  return 'ready';
}

/** Clé VAPID publique (base64url) → octets, format attendu par `pushManager.subscribe`. */
export function urlBase64ToUint8Array(base64Url: string): Uint8Array {
  const padded = base64Url + '='.repeat((4 - (base64Url.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export type PushSubscriptionJson = { endpoint: string; expirationTime?: number | null; keys: { p256dh: string; auth: string } };

/** Valide la forme d'un abonnement avant l'envoi au serveur (le serveur revalide). */
export function isValidSubscription(value: unknown): value is PushSubscriptionJson {
  const v = value as Partial<PushSubscriptionJson> | null;
  return !!v && typeof v.endpoint === 'string' && v.endpoint.startsWith('https://') && !!v.keys?.p256dh && !!v.keys?.auth;
}

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

// ───────────────────────── État d'enregistrement lu de la base (D-088) ─────────────────────────

/** Réponse de la RPC `my_push_status` : l'état des appareils DU MEMBRE connecté, tel que la base le connaît. */
export type ServerPushStatus = { activeDevices: number; thisDevice: boolean; lastPushAt: string | null; lastPushResult: string | null };

/** Valide la réponse de `my_push_status` (jamais de confiance aveugle). */
export function parseServerPushStatus(raw: unknown): ServerPushStatus | null {
  const r = raw as { active_devices?: unknown; this_device?: unknown; last_push_at?: unknown; last_push_result?: unknown } | null;
  if (!r || typeof r !== 'object' || typeof r.active_devices !== 'number' || typeof r.this_device !== 'boolean') return null;
  return {
    activeDevices: r.active_devices,
    thisDevice: r.this_device,
    lastPushAt: typeof r.last_push_at === 'string' ? r.last_push_at : null,
    lastPushResult: typeof r.last_push_result === 'string' ? r.last_push_result : null,
  };
}

/**
 * État affiché pour CET appareil. « Activé » (`on`) exige DEUX choses : un abonnement dans le navigateur ET une ligne `devices` active de ce membre côté base.
 *  - aucun abonnement local → `off` ;
 *  - abonnement local mais la base ne connaît pas ce navigateur pour ce membre (compte changé sur le même navigateur, enregistrement échoué) → `unsynced` ;
 *  - base injoignable → `unverified` (on n'affirme rien).
 */
export type DeviceState = 'off' | 'on' | 'unsynced' | 'unverified';
export function deviceState(hasSubscription: boolean, server: ServerPushStatus | null): DeviceState {
  if (!hasSubscription) return 'off';
  if (!server) return 'unverified';
  return server.thisDevice ? 'on' : 'unsynced';
}

/** Un abonnement existe déjà, la permission est accordée, mais la base ne connaît pas ce navigateur pour ce membre : on le réenregistre sans geste (aucune permission à demander). */
export const shouldHeal = (availability: WebPushAvailability, permission: 'default' | 'granted' | 'denied', hasSubscription: boolean, server: ServerPushStatus | null): boolean =>
  availability === 'ready' && permission === 'granted' && hasSubscription && server !== null && !server.thisDevice;

/** Pourquoi l'activation a échoué (message i18n précis, jamais un « erreur » générique). */
export type EnableFailure = 'unsupported' | 'not-configured' | 'needs-install' | 'denied' | 'no-service-worker' | 'subscribe-failed' | 'invalid-subscription' | 'server-failed';
export type EnableResult = { ok: true } | { ok: false; reason: EnableFailure };

/** Résultat d'un envoi de test (réponse de `send-push`, mode `test`) → message affiché. */
export type TestResponse = { vapidConfigured: boolean; devices: number; sent: number; webSent: number; noVapid: number; failures: { channel: string; code: string }[] };
export type TestOutcome = { kind: 'sent' } | { kind: 'no_device' } | { kind: 'no_vapid' } | { kind: 'error'; code: string | null };

export function parseTestResponse(raw: unknown): TestResponse | null {
  const r = raw as Partial<TestResponse> | null;
  if (!r || typeof r !== 'object' || typeof r.vapidConfigured !== 'boolean' || typeof r.devices !== 'number') return null;
  const failures = Array.isArray(r.failures) ? r.failures.filter((f): f is { channel: string; code: string } => !!f && typeof f.channel === 'string' && typeof f.code === 'string') : [];
  return { vapidConfigured: r.vapidConfigured, devices: r.devices, sent: typeof r.sent === 'number' ? r.sent : 0, webSent: typeof r.webSent === 'number' ? r.webSent : 0, noVapid: typeof r.noVapid === 'number' ? r.noVapid : 0, failures };
}

export function testOutcome(res: TestResponse): TestOutcome {
  if (res.sent + res.webSent > 0) return { kind: 'sent' };
  if (res.devices === 0) return { kind: 'no_device' };
  if (!res.vapidConfigured || res.noVapid > 0) return { kind: 'no_vapid' };
  return { kind: 'error', code: res.failures[0]?.code ?? null };
}

/** État du serveur d'envoi (réponse de `send-push`, mode `status`) pour Réglages → Diagnostic : des booléens et des compteurs, jamais une valeur secrète. */
export type PushServerStatus = { vapidConfigured: boolean; activeDevices: number; lastPushAt: string | null; lastPushResult: string | null };
export function parsePushServerStatus(raw: unknown): PushServerStatus | null {
  const r = raw as { vapidConfigured?: unknown; activeDevices?: unknown; lastPushAt?: unknown; lastPushResult?: unknown } | null;
  if (!r || typeof r !== 'object' || typeof r.vapidConfigured !== 'boolean' || typeof r.activeDevices !== 'number') return null;
  return { vapidConfigured: r.vapidConfigured, activeDevices: r.activeDevices, lastPushAt: typeof r.lastPushAt === 'string' ? r.lastPushAt : null, lastPushResult: typeof r.lastPushResult === 'string' ? r.lastPushResult : null };
}

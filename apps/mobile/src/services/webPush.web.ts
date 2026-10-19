import { fetchPushStatus, registerWebPush, sendTestPush, unregisterWebPush } from '@/api/notifications';
import { config } from '@/config';
import {
  deviceState,
  isValidSubscription,
  shouldHeal,
  testOutcome,
  urlBase64ToUint8Array,
  webPushAvailability,
  type EnableResult,
  type ServerPushStatus,
  type TestOutcome,
  type WebPushAvailability,
} from '@/domain/web-push';

/** `on` = abonnement du navigateur ET ligne `devices` active de ce membre en base ; `unsynced` = abonnement connu du navigateur seulement ; `unverified` = base injoignable (D-088). */
export type WebPushStatus = WebPushAvailability | 'off' | 'on' | 'unsynced' | 'unverified';

const READY_TIMEOUT_MS = 8000;

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches === true || (navigator as { standalone?: boolean }).standalone === true;
const permission = (): 'default' | 'granted' | 'denied' => ('Notification' in window ? Notification.permission : 'default');

function availability(): WebPushAvailability {
  return webPushAvailability({
    hasServiceWorker: 'serviceWorker' in navigator,
    hasPushManager: 'PushManager' in window,
    hasNotification: 'Notification' in window,
    isIos: isIos(),
    isStandalone: isStandalone(),
    vapidKey: config.vapidPublicKey,
    permission: permission(),
  });
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration();
  return (await registration?.pushManager.getSubscription()) ?? null;
}

/** `serviceWorker.ready` ne se résout jamais si aucun service worker n'est enregistré : sans délai, l'activation resterait figée sans message. */
async function readyRegistration(): Promise<ServiceWorkerRegistration | null> {
  return Promise.race([navigator.serviceWorker.ready, new Promise<null>((resolve) => setTimeout(() => resolve(null), READY_TIMEOUT_MS))]);
}

/** Enregistre l'abonnement auprès de la base ; lève si la RPC échoue. */
async function register(subscription: PushSubscription): Promise<'ok' | 'invalid'> {
  const json = subscription.toJSON();
  if (!isValidSubscription(json)) return 'invalid';
  await registerWebPush(json);
  return 'ok';
}

/**
 * Réparation silencieuse (D-088) : abonnement présent et permission accordée, mais la base ne connaît pas ce navigateur pour ce membre
 * (compte changé sur le même navigateur, enregistrement qui avait échoué). Aucune permission à demander : on réenregistre simplement.
 */
async function heal(subscription: PushSubscription, server: ServerPushStatus | null): Promise<ServerPushStatus | null> {
  if (!shouldHeal(availability(), permission(), true, server)) return server;
  try {
    if ((await register(subscription)) !== 'ok') return server;
  } catch {
    return server;
  }
  return fetchPushStatus(subscription.endpoint);
}

export async function getWebPushStatus(): Promise<WebPushStatus> {
  const a = availability();
  if (a !== 'ready') return a;
  const subscription = await currentSubscription();
  if (!subscription) return 'off';
  const server = await heal(subscription, await fetchPushStatus(subscription.endpoint));
  return deviceState(true, server);
}

/** À appeler depuis un geste de l'utilisateur (obligatoire sur iOS) : permission → abonnement → enregistrement serveur. Chaque échec a sa raison. */
export async function enableWebPush(): Promise<EnableResult> {
  const a = availability();
  if (a === 'unsupported' || a === 'not-configured' || a === 'needs-install') return { ok: false, reason: a };
  try {
    if ((await Notification.requestPermission()) !== 'granted') return { ok: false, reason: 'denied' };
    const registration = await readyRegistration();
    if (!registration) return { ok: false, reason: 'no-service-worker' };
    let subscription: PushSubscription;
    try {
      subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(config.vapidPublicKey) as BufferSource }));
    } catch {
      return { ok: false, reason: 'subscribe-failed' };
    }
    try {
      if ((await register(subscription)) === 'invalid') return { ok: false, reason: 'invalid-subscription' };
    } catch {
      return { ok: false, reason: 'server-failed' };
    }
    // Ne jamais affirmer « activé » sans que la base le confirme.
    const server = await fetchPushStatus(subscription.endpoint);
    return server?.thisDevice ? { ok: true } : { ok: false, reason: 'server-failed' };
  } catch {
    return { ok: false, reason: 'subscribe-failed' };
  }
}

export async function disableWebPush(): Promise<void> {
  const subscription = await currentSubscription();
  if (!subscription) return;
  await unregisterWebPush(subscription.endpoint).catch(() => undefined);
  await subscription.unsubscribe();
}

/** Envoie une notification de test à CET appareil et rend le résultat à afficher. */
export async function sendTestNotification(): Promise<TestOutcome> {
  const subscription = availability() === 'unsupported' ? null : await currentSubscription().catch(() => null);
  const res = await sendTestPush(subscription?.endpoint ?? null).catch(() => null);
  return res ? testOutcome(res) : { kind: 'error', code: null };
}

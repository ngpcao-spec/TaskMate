import { registerWebPush, unregisterWebPush } from '@/api/notifications';
import { config } from '@/config';
import { isValidSubscription, urlBase64ToUint8Array, webPushAvailability, type WebPushAvailability } from '@/domain/web-push';

export type WebPushStatus = WebPushAvailability | 'off' | 'on';

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches === true || (navigator as { standalone?: boolean }).standalone === true;

function availability(): WebPushAvailability {
  return webPushAvailability({
    hasServiceWorker: 'serviceWorker' in navigator,
    hasPushManager: 'PushManager' in window,
    hasNotification: 'Notification' in window,
    isIos: isIos(),
    isStandalone: isStandalone(),
    vapidKey: config.vapidPublicKey,
    permission: 'Notification' in window ? Notification.permission : 'default',
  });
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration();
  return (await registration?.pushManager.getSubscription()) ?? null;
}

export async function getWebPushStatus(): Promise<WebPushStatus> {
  const a = availability();
  if (a !== 'ready') return a;
  return (await currentSubscription()) ? 'on' : 'off';
}

/** À appeler depuis un geste de l'utilisateur (obligatoire sur iOS) : permission → abonnement → enregistrement serveur. */
export async function enableWebPush(): Promise<'on' | 'denied' | 'failed'> {
  if (availability() === 'unsupported' || availability() === 'not-configured') return 'failed';
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return 'denied';
    const registration = await navigator.serviceWorker.ready;
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(config.vapidPublicKey) as BufferSource }));
    const json = subscription.toJSON();
    if (!isValidSubscription(json)) return 'failed';
    await registerWebPush(json);
    return 'on';
  } catch {
    return 'failed';
  }
}

export async function disableWebPush(): Promise<void> {
  const subscription = await currentSubscription();
  if (!subscription) return;
  await unregisterWebPush(subscription.endpoint).catch(() => undefined);
  await subscription.unsubscribe();
}

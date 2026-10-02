import { badgeTotal, documentTitleFor, latestAt, unreadCount } from '@/domain/notification-center';
import { isValidSubscription, urlBase64ToUint8Array, webPushAvailability, type WebPushEnv } from '@/domain/web-push';

const base: WebPushEnv = { hasServiceWorker: true, hasPushManager: true, hasNotification: true, isIos: false, isStandalone: false, vapidKey: 'KEY', permission: 'default' };

describe('disponibilité du Web Push', () => {
  it('prêt sur un navigateur compatible et configuré', () => {
    expect(webPushAvailability(base)).toBe('ready');
  });
  it('iOS hors PWA installée : demande d\'installer sur l\'écran d\'accueil (même si PushManager est absent)', () => {
    expect(webPushAvailability({ ...base, isIos: true, hasPushManager: false })).toBe('needs-install');
    expect(webPushAvailability({ ...base, isIos: true, isStandalone: true })).toBe('ready');
  });
  it('navigateur sans service worker / push / notifications : non supporté', () => {
    expect(webPushAvailability({ ...base, hasPushManager: false })).toBe('unsupported');
    expect(webPushAvailability({ ...base, hasServiceWorker: false })).toBe('unsupported');
    expect(webPushAvailability({ ...base, hasNotification: false })).toBe('unsupported');
  });
  it('clé VAPID absente ou permission refusée', () => {
    expect(webPushAvailability({ ...base, vapidKey: '' })).toBe('not-configured');
    expect(webPushAvailability({ ...base, permission: 'denied' })).toBe('denied');
  });
});

describe('clé VAPID et abonnement', () => {
  it('décode le base64url (sans padding) en octets', () => {
    expect(Array.from(urlBase64ToUint8Array('AQID'))).toEqual([1, 2, 3]);
    expect(Array.from(urlBase64ToUint8Array('-_8'))).toEqual([251, 255]);
  });
  it('valide la forme d\'un abonnement', () => {
    expect(isValidSubscription({ endpoint: 'https://push.example/x', keys: { p256dh: 'a', auth: 'b' } })).toBe(true);
    expect(isValidSubscription({ endpoint: 'http://push.example/x', keys: { p256dh: 'a', auth: 'b' } })).toBe(false);
    expect(isValidSubscription({ endpoint: 'https://push.example/x' })).toBe(false);
    expect(isValidSubscription(null)).toBe(false);
  });
});

describe('centre de notifications : non lues et badge', () => {
  const rows = [{ at: '2026-10-02T08:00:00+00:00' }, { at: '2026-10-02T09:30:00+00:00' }, { at: '2026-10-01T20:00:00+00:00' }];
  it('compte les éléments plus récents que le dernier passage', () => {
    expect(unreadCount(rows, null)).toBe(3);
    expect(unreadCount(rows, '2026-10-02T08:00:00+00:00')).toBe(1);
    expect(unreadCount(rows, '2026-10-02T10:00:00+00:00')).toBe(0);
    expect(unreadCount([], null)).toBe(0);
  });
  it('trouve le plus récent', () => {
    expect(latestAt(rows)).toBe('2026-10-02T09:30:00+00:00');
    expect(latestAt([])).toBeNull();
  });
  it('badge = non lues + à valider ; titre d\'onglet', () => {
    expect(badgeTotal(2, 3)).toBe(5);
    expect(badgeTotal(-1, 0)).toBe(0);
    expect(documentTitleFor(0)).toBe('TaskMate');
    expect(documentTitleFor(5)).toBe('(5) TaskMate');
    expect(documentTitleFor(150)).toBe('(99+) TaskMate');
  });
});

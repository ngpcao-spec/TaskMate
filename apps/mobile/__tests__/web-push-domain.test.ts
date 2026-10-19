import { badgeTotal, documentTitleFor, latestAt, unreadCount } from '@/domain/notification-center';
import {
  deviceState,
  isValidSubscription,
  parsePushServerStatus,
  parseServerPushStatus,
  parseTestResponse,
  shouldHeal,
  testOutcome,
  urlBase64ToUint8Array,
  webPushAvailability,
  type ServerPushStatus,
  type TestResponse,
  type WebPushEnv,
} from '@/domain/web-push';

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

describe('état d’enregistrement lu de la base (D-088)', () => {
  const here: ServerPushStatus = { activeDevices: 1, thisDevice: true, lastPushAt: null, lastPushResult: null };
  const elsewhere: ServerPushStatus = { ...here, thisDevice: false };

  it('lit la réponse de my_push_status ; une réponse illisible vaut « base injoignable »', () => {
    expect(parseServerPushStatus({ active_devices: 2, this_device: true, last_push_at: '2026-10-19T08:00:00Z', last_push_result: 'sent' })).toEqual({ activeDevices: 2, thisDevice: true, lastPushAt: '2026-10-19T08:00:00Z', lastPushResult: 'sent' });
    expect(parseServerPushStatus({ active_devices: 0, this_device: false })).toEqual({ activeDevices: 0, thisDevice: false, lastPushAt: null, lastPushResult: null });
    for (const bad of [null, 'x', {}, { active_devices: '1', this_device: true }, { active_devices: 1 }]) expect(parseServerPushStatus(bad)).toBeNull();
  });

  it('« activé » exige un abonnement ET une ligne active de ce membre', () => {
    expect(deviceState(false, here)).toBe('off');
    expect(deviceState(false, null)).toBe('off');
    expect(deviceState(true, here)).toBe('on');
    expect(deviceState(true, elsewhere)).toBe('unsynced'); // l'ancien comportement affichait « bật » ici
    expect(deviceState(true, null)).toBe('unverified');
  });

  it('réparation silencieuse seulement si tout est réuni, jamais sans abonnement ni permission', () => {
    expect(shouldHeal('ready', 'granted', true, elsewhere)).toBe(true);
    expect(shouldHeal('ready', 'granted', true, here)).toBe(false);
    expect(shouldHeal('ready', 'granted', true, null)).toBe(false);
    expect(shouldHeal('ready', 'granted', false, elsewhere)).toBe(false);
    expect(shouldHeal('ready', 'default', true, elsewhere)).toBe(false);
    expect(shouldHeal('denied', 'denied', true, elsewhere)).toBe(false);
    expect(shouldHeal('needs-install', 'granted', true, elsewhere)).toBe(false);
  });
});

describe('envoi de test (D-088)', () => {
  const res = (over: Partial<TestResponse> = {}): TestResponse => ({ vapidConfigured: true, devices: 1, sent: 0, webSent: 0, noVapid: 0, failures: [], ...over });

  it('lit la réponse de send-push ; réponse illisible = null', () => {
    expect(parseTestResponse({ vapidConfigured: true, devices: 2, sent: 1, webSent: 1, noVapid: 0, failures: [{ channel: 'web', code: 'failed:500' }, { x: 1 }] })).toEqual(res({ devices: 2, sent: 1, webSent: 1, failures: [{ channel: 'web', code: 'failed:500' }] }));
    expect(parseTestResponse({ vapidConfigured: true, devices: 0 })).toEqual(res({ devices: 0 }));
    for (const bad of [null, 'x', {}, { vapidConfigured: 'yes', devices: 1 }]) expect(parseTestResponse(bad)).toBeNull();
  });

  it('un résultat par cas : envoyé, aucun appareil, VAPID absente, erreur', () => {
    expect(testOutcome(res({ webSent: 1 }))).toEqual({ kind: 'sent' });
    expect(testOutcome(res({ sent: 1 }))).toEqual({ kind: 'sent' });
    expect(testOutcome(res({ devices: 0 }))).toEqual({ kind: 'no_device' });
    expect(testOutcome(res({ vapidConfigured: false }))).toEqual({ kind: 'no_vapid' });
    expect(testOutcome(res({ noVapid: 1 }))).toEqual({ kind: 'no_vapid' });
    expect(testOutcome(res({ failures: [{ channel: 'web', code: 'gone' }] }))).toEqual({ kind: 'error', code: 'gone' });
    expect(testOutcome(res())).toEqual({ kind: 'error', code: null });
  });

  it('état du serveur pour le diagnostic : booléens et compteurs seulement', () => {
    expect(parsePushServerStatus({ vapidConfigured: false, activeDevices: 0, lastPushAt: null, lastPushResult: null })).toEqual({ vapidConfigured: false, activeDevices: 0, lastPushAt: null, lastPushResult: null });
    expect(parsePushServerStatus({ vapidConfigured: true, activeDevices: 2, lastPushAt: '2026-10-19T08:00:00Z', lastPushResult: 'sent', secret: 'x' })).toEqual({ vapidConfigured: true, activeDevices: 2, lastPushAt: '2026-10-19T08:00:00Z', lastPushResult: 'sent' });
    for (const bad of [null, 'x', {}, { vapidConfigured: 'true', activeDevices: 1 }, { vapidConfigured: true }]) expect(parsePushServerStatus(bad)).toBeNull();
  });
});

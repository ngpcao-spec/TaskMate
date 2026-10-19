import { getWebPushStatus, enableWebPush, sendTestNotification } from '@/services/webPush.web';

const mockFetchStatus = jest.fn();
const mockRegister = jest.fn();
const mockSendTest = jest.fn();
let mockVapid = 'KEY';
jest.mock('@/api/notifications', () => ({
  fetchPushStatus: (...a: unknown[]) => mockFetchStatus(...a),
  registerWebPush: (...a: unknown[]) => mockRegister(...a),
  unregisterWebPush: jest.fn(),
  sendTestPush: (...a: unknown[]) => mockSendTest(...a),
}));
jest.mock('@/config', () => ({ config: { get vapidPublicKey() { return mockVapid; } } }));

const SUB = { endpoint: 'https://push.example/x', keys: { p256dh: 'a', auth: 'b' } };
const subscription = { endpoint: SUB.endpoint, toJSON: () => SUB, unsubscribe: jest.fn() };
let mockExisting: typeof subscription | null;
let mockPermission: 'default' | 'granted' | 'denied';
let mockRequest: 'granted' | 'denied';
let mockSubscribe: jest.Mock;

function setup(opts: { sw?: boolean; ios?: boolean; standalone?: boolean; readyNever?: boolean } = {}) {
  const registration = { pushManager: { getSubscription: async () => mockExisting, subscribe: mockSubscribe } };
  const nav: Record<string, unknown> = {
    userAgent: opts.ios ? 'iPhone' : 'Chrome',
    platform: 'Linux',
    maxTouchPoints: 0,
    standalone: opts.standalone,
  };
  if (opts.sw !== false) nav.serviceWorker = { getRegistration: async () => registration, ready: opts.readyNever ? new Promise(() => undefined) : Promise.resolve(registration) };
  const win: Record<string, unknown> = {
    PushManager: function PushManager() {},
    Notification: Object.defineProperties(function Notification() {}, {
      permission: { get: () => mockPermission },
      requestPermission: { value: async () => { mockPermission = mockRequest; return mockRequest; } },
    }),
    matchMedia: () => ({ matches: opts.standalone === true }),
  };
  Object.defineProperty(globalThis, 'navigator', { value: nav, configurable: true });
  Object.defineProperty(globalThis, 'window', { value: win, configurable: true });
  Object.defineProperty(globalThis, 'Notification', { value: win.Notification, configurable: true });
}

describe('service Web Push (D-088) : l’état vient de la base', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVapid = 'KEY';
    mockExisting = subscription;
    mockPermission = 'granted';
    mockRequest = 'granted';
    mockSubscribe = jest.fn(async () => subscription);
    mockRegister.mockResolvedValue(undefined);
    mockFetchStatus.mockResolvedValue({ activeDevices: 1, thisDevice: true, lastPushAt: null, lastPushResult: null });
    setup();
  });

  it('abonnement + ligne active de ce membre : « on »', async () => {
    expect(await getWebPushStatus()).toBe('on');
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('abonnement du navigateur mais aucune ligne pour ce membre (le cas Ba) : réparation silencieuse puis « on »', async () => {
    mockFetchStatus.mockResolvedValueOnce({ activeDevices: 0, thisDevice: false, lastPushAt: null, lastPushResult: null }).mockResolvedValueOnce({ activeDevices: 1, thisDevice: true, lastPushAt: null, lastPushResult: null });
    expect(await getWebPushStatus()).toBe('on');
    expect(mockRegister).toHaveBeenCalledWith(SUB);
  });

  it('réparation impossible (serveur refuse) : « unsynced », jamais « on »', async () => {
    mockFetchStatus.mockResolvedValue({ activeDevices: 0, thisDevice: false, lastPushAt: null, lastPushResult: null });
    mockRegister.mockRejectedValue(new Error('403'));
    expect(await getWebPushStatus()).toBe('unsynced');
  });

  it('réparation sans effet côté base (la ligne reste absente) : « unsynced »', async () => {
    mockFetchStatus.mockResolvedValue({ activeDevices: 0, thisDevice: false, lastPushAt: null, lastPushResult: null });
    expect(await getWebPushStatus()).toBe('unsynced');
    expect(mockRegister).toHaveBeenCalledTimes(1);
  });

  it('base injoignable : « unverified » ; aucun abonnement : « off »', async () => {
    mockFetchStatus.mockResolvedValue(null);
    expect(await getWebPushStatus()).toBe('unverified');
    mockExisting = null;
    expect(await getWebPushStatus()).toBe('off');
  });

  it('pas de réparation sans permission accordée', async () => {
    mockPermission = 'default';
    mockFetchStatus.mockResolvedValue({ activeDevices: 0, thisDevice: false, lastPushAt: null, lastPushResult: null });
    expect(await getWebPushStatus()).toBe('unsynced');
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('iPhone hors PWA : « needs-install » ; navigateur sans push : « unsupported » ; sans clé : « not-configured »', async () => {
    setup({ ios: true });
    expect(await getWebPushStatus()).toBe('needs-install');
    setup({ sw: false });
    expect(await getWebPushStatus()).toBe('unsupported');
    setup();
    mockVapid = '';
    expect(await getWebPushStatus()).toBe('not-configured');
  });
});

describe('activation : une raison précise à chaque échec', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVapid = 'KEY';
    mockExisting = null;
    mockPermission = 'default';
    mockRequest = 'granted';
    mockSubscribe = jest.fn(async () => subscription);
    mockRegister.mockResolvedValue(undefined);
    mockFetchStatus.mockResolvedValue({ activeDevices: 1, thisDevice: true, lastPushAt: null, lastPushResult: null });
    setup();
  });

  it('succès : abonnement créé, enregistré, puis confirmé par la base', async () => {
    expect(await enableWebPush()).toEqual({ ok: true });
    expect(mockSubscribe).toHaveBeenCalledTimes(1);
    expect(mockRegister).toHaveBeenCalledWith(SUB);
    expect(mockFetchStatus).toHaveBeenCalledWith(SUB.endpoint);
  });

  it('permission refusée', async () => {
    mockRequest = 'denied';
    expect(await enableWebPush()).toEqual({ ok: false, reason: 'denied' });
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('indisponibilités : iOS hors PWA, navigateur incompatible, clé absente', async () => {
    setup({ ios: true });
    expect(await enableWebPush()).toEqual({ ok: false, reason: 'needs-install' });
    setup({ sw: false });
    expect(await enableWebPush()).toEqual({ ok: false, reason: 'unsupported' });
    setup();
    mockVapid = '';
    expect(await enableWebPush()).toEqual({ ok: false, reason: 'not-configured' });
  });

  it('service worker jamais prêt : délai dépassé', async () => {
    jest.useFakeTimers();
    setup({ readyNever: true });
    const run = enableWebPush();
    await jest.advanceTimersByTimeAsync(9000);
    expect(await run).toEqual({ ok: false, reason: 'no-service-worker' });
    jest.useRealTimers();
  });

  it('abonnement refusé par le service push, abonnement invalide, serveur qui refuse ou ne confirme pas', async () => {
    mockSubscribe.mockRejectedValue(new Error('push service error'));
    expect(await enableWebPush()).toEqual({ ok: false, reason: 'subscribe-failed' });
    mockSubscribe = jest.fn(async () => ({ ...subscription, toJSON: () => ({ endpoint: 'http://x', keys: {} }) }));
    setup();
    expect(await enableWebPush()).toEqual({ ok: false, reason: 'invalid-subscription' });
    mockSubscribe = jest.fn(async () => subscription);
    setup();
    mockRegister.mockRejectedValue(new Error('403'));
    expect(await enableWebPush()).toEqual({ ok: false, reason: 'server-failed' });
    mockRegister.mockResolvedValue(undefined);
    mockFetchStatus.mockResolvedValue({ activeDevices: 0, thisDevice: false, lastPushAt: null, lastPushResult: null });
    expect(await enableWebPush()).toEqual({ ok: false, reason: 'server-failed' }); // jamais « activé » sans ligne en base
  });
});

describe('notification de test', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExisting = subscription;
    mockPermission = 'granted';
    setup();
  });
  it('envoyée / aucun appareil / VAPID absente / erreur / serveur muet', async () => {
    mockSendTest.mockResolvedValue({ vapidConfigured: true, devices: 1, sent: 0, webSent: 1, noVapid: 0, failures: [] });
    expect(await sendTestNotification()).toEqual({ kind: 'sent' });
    expect(mockSendTest).toHaveBeenCalledWith(SUB.endpoint);
    mockSendTest.mockResolvedValue({ vapidConfigured: true, devices: 0, sent: 0, webSent: 0, noVapid: 0, failures: [] });
    expect(await sendTestNotification()).toEqual({ kind: 'no_device' });
    mockSendTest.mockResolvedValue({ vapidConfigured: false, devices: 1, sent: 0, webSent: 0, noVapid: 1, failures: [] });
    expect(await sendTestNotification()).toEqual({ kind: 'no_vapid' });
    mockSendTest.mockResolvedValue({ vapidConfigured: true, devices: 1, sent: 0, webSent: 0, noVapid: 0, failures: [{ channel: 'web', code: 'gone' }] });
    expect(await sendTestNotification()).toEqual({ kind: 'error', code: 'gone' });
    mockSendTest.mockResolvedValue(null);
    expect(await sendTestNotification()).toEqual({ kind: 'error', code: null });
    mockSendTest.mockRejectedValue(new Error('network'));
    expect(await sendTestNotification()).toEqual({ kind: 'error', code: null });
  });
});

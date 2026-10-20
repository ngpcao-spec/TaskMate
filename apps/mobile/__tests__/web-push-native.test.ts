import { disableWebPush, enableWebPush, getWebPushStatus, installState, sendTestNotification, thisDeviceRegistered } from '@/services/webPush';

const mockStatus = jest.fn();
jest.mock('@/api/notifications', () => ({ fetchPushStatus: (...a: unknown[]) => mockStatus(...a) }));

describe('Web Push côté natif (stub) et état de l’appareil', () => {
  it('le Web Push n’existe pas en natif (les push passent par expo-notifications)', async () => {
    expect(await getWebPushStatus()).toBe('unsupported');
    expect(await enableWebPush()).toEqual({ ok: false, reason: 'unsupported' });
    expect(await sendTestNotification()).toEqual({ kind: 'error', code: null });
    await expect(disableWebPush()).resolves.toBeUndefined();
  });
  it('appareil enregistré = au moins un appareil actif du membre en base', async () => {
    mockStatus.mockResolvedValue({ activeDevices: 1, thisDevice: false, lastPushAt: null, lastPushResult: null });
    expect(await thisDeviceRegistered()).toBe(true);
    expect(mockStatus).toHaveBeenCalledWith(null);
    mockStatus.mockResolvedValue({ activeDevices: 0, thisDevice: false, lastPushAt: null, lastPushResult: null });
    expect(await thisDeviceRegistered()).toBe(false);
    mockStatus.mockResolvedValue(null);
    expect(await thisDeviceRegistered()).toBe(false);
  });
  it('aucune installation à demander en natif', () => {
    expect(installState()).toEqual({ ios: false, standalone: true });
  });
});

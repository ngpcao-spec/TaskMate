import { registerDevice, registerWebPush, setPushLocale, syncPushLocale } from '@/api/notifications';

const mockRpc = jest.fn();
jest.mock('@/api/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => mockRpc(...a) } }));
let mockStored: string | null = null;
jest.mock('@/sync/storage', () => ({ kvStorage: { getItem: jest.fn(() => mockStored), setItem: jest.fn(), removeItem: jest.fn() } }));

const sub = { endpoint: 'https://push.example/x', keys: { p256dh: 'k', auth: 'a' } };

describe('langue des notifications push (D-063)', () => {
  beforeEach(() => { jest.clearAllMocks(); mockStored = null; mockRpc.mockResolvedValue({ error: null }); });

  it('setPushLocale envoie la langue choisie (vietnamien par défaut) par la RPC dédiée', async () => {
    await setPushLocale();
    expect(mockRpc).toHaveBeenCalledWith('set_push_locale', { p_locale: 'vi' });
    mockStored = 'fr';
    await setPushLocale();
    expect(mockRpc).toHaveBeenLastCalledWith('set_push_locale', { p_locale: 'fr' });
    await setPushLocale('en');
    expect(mockRpc).toHaveBeenLastCalledWith('set_push_locale', { p_locale: 'en' });
  });

  it('une langue enregistrée invalide retombe sur le vietnamien', async () => {
    mockStored = 'de';
    await setPushLocale();
    expect(mockRpc).toHaveBeenCalledWith('set_push_locale', { p_locale: 'vi' });
  });

  it('enregistrer un appareil mobile, puis envoyer sa langue', async () => {
    mockStored = 'en';
    await registerDevice('ExpoPushToken[x]', 'ios');
    expect(mockRpc.mock.calls.map((c) => c[0])).toEqual(['register_device', 'set_push_locale']);
    expect(mockRpc).toHaveBeenLastCalledWith('set_push_locale', { p_locale: 'en' });
  });

  it('enregistrer un navigateur (Web Push), puis envoyer sa langue', async () => {
    mockStored = 'fr';
    await registerWebPush(sub);
    expect(mockRpc.mock.calls.map((c) => c[0])).toEqual(['register_web_push', 'set_push_locale']);
    expect(mockRpc).toHaveBeenLastCalledWith('set_push_locale', { p_locale: 'fr' });
  });

  it('un échec d’enregistrement est propagé et la langue n’est pas envoyée', async () => {
    mockRpc.mockResolvedValueOnce({ error: new Error('boom') });
    await expect(registerDevice('t', 'ios')).rejects.toThrow('boom');
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });

  it('un échec de l’envoi de la langue ne fait pas échouer l’enregistrement ni un changement de langue', async () => {
    mockRpc.mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: new Error('offline') });
    await expect(registerDevice('t', 'android')).resolves.toBeUndefined();
    mockRpc.mockResolvedValueOnce({ error: new Error('offline') });
    await expect(syncPushLocale()).resolves.toBeUndefined();
    mockRpc.mockRejectedValueOnce(new Error('réseau coupé'));
    await expect(syncPushLocale()).resolves.toBeUndefined();
  });

  it('setPushLocale seul remonte l’erreur (le serveur refuse une langue inconnue)', async () => {
    mockRpc.mockResolvedValueOnce({ error: new Error('invalid_locale') });
    await expect(setPushLocale('fr')).rejects.toThrow('invalid_locale');
  });
});

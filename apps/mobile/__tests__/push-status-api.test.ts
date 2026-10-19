import { fetchPushStatus, sendTestPush } from '@/api/notifications';

const mockRpc = jest.fn();
const mockInvoke = jest.fn();
jest.mock('@/api/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => mockRpc(...a), functions: { invoke: (...a: unknown[]) => mockInvoke(...a) } } }));
jest.mock('@/sync/storage', () => ({ kvStorage: { getItem: jest.fn(() => null), setItem: jest.fn(), removeItem: jest.fn() } }));

describe('état des appareils lu de la base (D-088)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('my_push_status : transmet l’endpoint du navigateur et valide la réponse', async () => {
    mockRpc.mockResolvedValue({ data: { active_devices: 1, this_device: true, last_push_at: null, last_push_result: null }, error: null });
    expect(await fetchPushStatus('https://push.example/x')).toEqual({ activeDevices: 1, thisDevice: true, lastPushAt: null, lastPushResult: null });
    expect(mockRpc).toHaveBeenCalledWith('my_push_status', { p_endpoint: 'https://push.example/x' });
    await fetchPushStatus(null);
    expect(mockRpc).toHaveBeenLastCalledWith('my_push_status', {});
  });

  it('erreur, réponse illisible ou exception = null (« non vérifiable »), jamais « activé »', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { code: 'PGRST202' } });
    expect(await fetchPushStatus('e')).toBeNull();
    mockRpc.mockResolvedValue({ data: { nope: 1 }, error: null });
    expect(await fetchPushStatus('e')).toBeNull();
    mockRpc.mockRejectedValue(new Error('network'));
    expect(await fetchPushStatus('e')).toBeNull();
  });

  it('envoi de test : Edge Function send-push, mode test, avec l’endpoint', async () => {
    mockInvoke.mockResolvedValue({ data: { vapidConfigured: true, devices: 1, sent: 0, webSent: 1, noVapid: 0, failures: [] }, error: null });
    expect(await sendTestPush('https://push.example/x')).toMatchObject({ webSent: 1 });
    expect(mockInvoke).toHaveBeenCalledWith('send-push', { method: 'POST', body: { type: 'test', endpoint: 'https://push.example/x' } });
    await sendTestPush(null);
    expect(mockInvoke).toHaveBeenLastCalledWith('send-push', { method: 'POST', body: { type: 'test' } });
    mockInvoke.mockResolvedValue({ data: null, error: { message: 'boom' } });
    expect(await sendTestPush(null)).toBeNull();
  });
});

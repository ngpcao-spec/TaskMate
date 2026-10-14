import { confirmAvatar, discardAvatarCandidate, fetchAvatars, generateAvatar, removeAvatar, setAvatarAllowed } from '@/api/avatars';
import { GenerateError } from '@/api/generate';

const mockRpc = jest.fn();
const mockInvoke = jest.fn();
let mockSelect: { data: unknown; error: unknown } = { data: [], error: null };
const mockFromCalls: string[] = [];
jest.mock('@/sync/storage', () => ({ kvStorage: { getItem: jest.fn(() => null), setItem: jest.fn(), removeItem: jest.fn() } }));
jest.mock('@/api/supabase', () => ({
  supabase: {
    from: (table: string) => ({ select: async (cols: string) => { mockFromCalls.push(`${table}:${cols}`); return mockSelect; } }),
    rpc: (...args: unknown[]) => mockRpc(...args),
    functions: { invoke: (...args: unknown[]) => mockInvoke(...args) },
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockFromCalls.length = 0;
  mockSelect = { data: [], error: null };
  mockRpc.mockResolvedValue({ error: null });
});

describe('API des avatars (D-071)', () => {
  it('lit uniquement les colonnes autorisées (jamais le candidat)', async () => {
    mockSelect = { data: [{ child_id: 'c1', ai_allowed: true, image_b64: 'UklGRg==', version: 2 }], error: null };
    const map = await fetchAvatars();
    expect(mockFromCalls).toEqual(['child_avatars:child_id, ai_allowed, image_b64, version']);
    expect(mockFromCalls[0]).not.toContain('candidate');
    expect(map.c1).toEqual({ allowed: true, uri: 'data:image/webp;base64,UklGRg==', version: 2 });
  });

  it('remonte l’erreur de lecture', async () => {
    mockSelect = { data: null, error: { code: '42501', message: 'denied' } };
    await expect(fetchAvatars()).rejects.toMatchObject({ code: '42501' });
  });

  it('consentement, validation, abandon, suppression : des RPC, jamais d’écriture directe', async () => {
    await setAvatarAllowed('c1', true);
    await confirmAvatar('c1');
    await discardAvatarCandidate('c1');
    await removeAvatar('c1');
    expect(mockRpc.mock.calls).toEqual([
      ['set_avatar_ai_allowed', { p_child: 'c1', p_allowed: true }],
      ['confirm_child_avatar', { p_child: 'c1' }],
      ['discard_avatar_candidate', { p_child: 'c1' }],
      ['remove_child_avatar', { p_child: 'c1' }],
    ]);
  });

  it.each([
    ['setAvatarAllowed', () => setAvatarAllowed('c1', false)],
    ['confirmAvatar', () => confirmAvatar('c1')],
    ['discardAvatarCandidate', () => discardAvatarCandidate('c1')],
    ['removeAvatar', () => removeAvatar('c1')],
  ])('%s : remonte l’erreur de la base', async (_name, call) => {
    mockRpc.mockResolvedValue({ error: { message: 'forbidden' } });
    await expect(call()).rejects.toMatchObject({ message: 'forbidden' });
  });

  it('parent : envoie le portrait ET l’enfant visé à la fonction', async () => {
    mockInvoke.mockResolvedValue({ data: { candidate: 'UklGRg==', child_id: 'c1', remaining: 2 }, error: null });
    expect(await generateAvatar('AAAA', 'c1')).toEqual({ candidate: 'UklGRg==', child_id: 'c1', remaining: 2 });
    expect(mockInvoke).toHaveBeenCalledWith('generate-avatar', { method: 'POST', body: { childId: 'c1', image: 'AAAA' } });
  });

  it('enfant : n’envoie aucun identifiant (la fonction le déduit de son jeton)', async () => {
    mockInvoke.mockResolvedValue({ data: { candidate: 'UklGRg==', child_id: 'c1', remaining: 2 }, error: null });
    await generateAvatar('AAAA', null);
    expect(mockInvoke).toHaveBeenCalledWith('generate-avatar', { method: 'POST', body: { image: 'AAAA' } });
  });

  it('erreur de la fonction : code court conservé (ex. quota)', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { context: { json: async () => ({ error: 'quota_exceeded', limit: 3, used: 3 }) } } });
    const failure = await generateAvatar('AAAA', 'c1').catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(GenerateError);
    expect(failure).toMatchObject({ code: 'quota_exceeded', details: { limit: 3, used: 3 } });
  });

  it('réseau coupé : code « network »', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: new Error('Failed to fetch') });
    await expect(generateAvatar('AAAA', 'c1')).rejects.toMatchObject({ code: 'network' });
  });
});

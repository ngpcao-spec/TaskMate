import { collectAdventure, fetchAdventureState, startAdventure } from '@/api/adventure';

const mockRpc = jest.fn();
const mockFrom = jest.fn();
jest.mock('@/api/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => mockRpc(...a), from: (...a: unknown[]) => mockFrom(...a) } }));

beforeEach(() => {
  jest.clearAllMocks();
  mockRpc.mockResolvedValue({ data: null, error: null });
});

describe('API des aventures (D-105)', () => {
  it('état lu par adventure_state', async () => {
    mockRpc.mockResolvedValue({ data: { gauge: 12, cost: 30, state: 'filling', level: 1, destinations: [], found: [], found_count: 0, total_count: 30 }, error: null });
    const s = await fetchAdventureState('c1');
    expect(mockRpc).toHaveBeenCalledWith('adventure_state', { p_child: 'c1' });
    expect(s).toMatchObject({ gauge: 12, state: 'filling', totalCount: 30 });
  });
  it('départ et récupération : des RPC (id fixé par l’appelant), jamais d’écriture directe', async () => {
    await startAdventure('c1', 'a1', 'ha-long');
    expect(mockRpc).toHaveBeenCalledWith('adventure_start', { p_child: 'c1', p_id: 'a1', p_destination: 'ha-long' });
    mockRpc.mockResolvedValue({ data: { discovery_slug: 'ha-long-perle', duplicate: true, destination: 'ha-long' }, error: null });
    expect(await collectAdventure('c1', 'a1')).toEqual({ discoverySlug: 'ha-long-perle', duplicate: true, destination: 'ha-long' });
    expect(mockRpc).toHaveBeenCalledWith('adventure_collect', { p_child: 'c1', p_adventure: 'a1' });
    expect(mockFrom).not.toHaveBeenCalled();
  });
  it('erreurs remontées (le code décide du message doux)', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { code: 'P0001', message: 'not_back_yet' } });
    await expect(collectAdventure('c1', 'a1')).rejects.toMatchObject({ message: 'not_back_yet' });
    await expect(startAdventure('c1', 'a1', 'ha-long')).rejects.toMatchObject({ message: 'not_back_yet' });
    await expect(fetchAdventureState('c1')).rejects.toMatchObject({ message: 'not_back_yet' });
  });
});

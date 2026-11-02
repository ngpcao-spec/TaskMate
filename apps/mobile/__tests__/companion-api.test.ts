import { fetchCompanionState, setCompanionStageOffset, setupCompanion } from '@/api/companion';

const mockRpc = jest.fn();
const mockFrom = jest.fn();
jest.mock('@/api/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => mockRpc(...a), from: (...a: unknown[]) => mockFrom(...a) } }));

beforeEach(() => {
  jest.clearAllMocks();
  mockRpc.mockResolvedValue({ data: null, error: null });
});

describe('API du compagnon (D-104)', () => {
  it('lit l’état par la RPC companion_state et le met en forme', async () => {
    mockRpc.mockResolvedValue({ data: { has_companion: true, name: 'Bambou', trait: 'brave', stage: 3, stage_offset: -1, energy_total: 75, level: 2, next_level_at: 150 }, error: null });
    const state = await fetchCompanionState('c1');
    expect(mockRpc).toHaveBeenCalledWith('companion_state', { p_child: 'c1' });
    expect(state).toEqual({ hasCompanion: true, name: 'Bambou', trait: 'brave', variant: 'boy', stage: 3, stageOffset: -1, energyTotal: 75, level: 2, nextLevelAt: 150 });
  });

  it('remonte l’erreur (« forbidden » pour un autre enfant)', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'forbidden' } });
    await expect(fetchCompanionState('c2')).rejects.toMatchObject({ message: 'forbidden' });
  });

  it('nom, trait et décalage passent par des RPC, jamais par une écriture directe', async () => {
    await setupCompanion('c1', 'Mochi', 'calm');
    expect(mockRpc).toHaveBeenCalledWith('companion_setup', { p_child: 'c1', p_name: 'Mochi', p_trait: 'calm' });
    await setCompanionStageOffset('c1', 1);
    expect(mockRpc).toHaveBeenCalledWith('companion_set_stage_offset', { p_child: 'c1', p_offset: 1 });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('erreurs d’écriture remontées', async () => {
    mockRpc.mockResolvedValue({ error: { code: 'P0001', message: 'invalid_input' } });
    await expect(setupCompanion('c1', '', 'kind')).rejects.toMatchObject({ message: 'invalid_input' });
    await expect(setCompanionStageOffset('c1', 0)).rejects.toMatchObject({ message: 'invalid_input' });
  });
});

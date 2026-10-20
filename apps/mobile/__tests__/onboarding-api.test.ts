import { fetchOnboarding, hideSetupCard, restartOnboarding, setOnboardingStep } from '@/api/onboarding';

const mockRpc = jest.fn();
jest.mock('@/api/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => mockRpc(...a) } }));

const good = { is_owner: true, language_confirmed: false, skipped: [], card_hidden: false, children: [], tasks: 0, rewards: 0, parents: 1, invite_active: false };

describe('API de l’assistant (D-090) : RPC seulement, jamais d’écriture directe', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lit l’état par la RPC et le valide', async () => {
    mockRpc.mockResolvedValue({ data: good, error: null });
    expect(await fetchOnboarding()).toMatchObject({ isOwner: true, languageConfirmed: false, children: [] });
    expect(mockRpc).toHaveBeenCalledWith('onboarding_state');
  });
  it('réponse illisible ou erreur serveur : lève (jamais un état inventé)', async () => {
    mockRpc.mockResolvedValue({ data: { nope: 1 }, error: null });
    await expect(fetchOnboarding()).rejects.toThrow('onboarding_unreadable');
    mockRpc.mockResolvedValue({ data: null, error: { message: 'forbidden' } });
    await expect(fetchOnboarding()).rejects.toEqual({ message: 'forbidden' });
  });
  it('confirmer / passer / rétablir une étape', async () => {
    mockRpc.mockResolvedValue({ error: null });
    await setOnboardingStep('language', 'confirm');
    expect(mockRpc).toHaveBeenLastCalledWith('onboarding_set', { p_step: 'language', p_action: 'confirm' });
    await setOnboardingStep('subjects', 'skip');
    expect(mockRpc).toHaveBeenLastCalledWith('onboarding_set', { p_step: 'subjects', p_action: 'skip' });
    await setOnboardingStep('subjects', 'unskip');
    expect(mockRpc).toHaveBeenLastCalledWith('onboarding_set', { p_step: 'subjects', p_action: 'unskip' });
  });
  it('masquer la carte, relancer l’assistant', async () => {
    mockRpc.mockResolvedValue({ error: null });
    await hideSetupCard(true);
    expect(mockRpc).toHaveBeenLastCalledWith('onboarding_hide_card', { p_hidden: true });
    await restartOnboarding();
    expect(mockRpc).toHaveBeenLastCalledWith('onboarding_restart');
  });
  it('une erreur du serveur est relancée (par exemple « children_required »)', async () => {
    mockRpc.mockResolvedValue({ error: { message: 'children_required' } });
    await expect(setOnboardingStep('children', 'skip')).rejects.toEqual({ message: 'children_required' });
    await expect(hideSetupCard(false)).rejects.toBeTruthy();
    await expect(restartOnboarding()).rejects.toBeTruthy();
  });
});

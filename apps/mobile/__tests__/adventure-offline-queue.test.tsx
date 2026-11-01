import { onlineManager, QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { createTestQueryClient } from '../test-utils/queryClient';
import '@/i18n';
import { startVars, useCollectAdventure, useStartAdventure } from '@/hooks/useAdventure';
import { registerMutationDefaults } from '@/sync/mutations';

const mockStart = jest.fn();
const mockCollect = jest.fn();
jest.mock('@/api/adventure', () => ({ fetchAdventureState: jest.fn(), startAdventure: (...a: unknown[]) => mockStart(...a), collectAdventure: (...a: unknown[]) => mockCollect(...a) }));
jest.mock('@/api/supabase', () => ({ supabase: {} }));
let mockCounter = 0;
jest.mock('@/api/ids', () => ({ newId: jest.fn(() => `adv-${++mockCounter}`) }));

const clients: QueryClient[] = [];
const makeClient = () => {
  const client = createTestQueryClient();
  clients.push(client);
  registerMutationDefaults(client, { retryDelay: () => 0 });
  return client;
};
const wrap = (client: QueryClient) => {
  const Wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return Wrapper;
};

describe('aventures dans la file d’écritures (D-105)', () => {
  beforeEach(() => {
    mockStart.mockReset().mockResolvedValue(undefined);
    mockCollect.mockReset().mockResolvedValue({ discoverySlug: 'ha-long-perle', duplicate: false, destination: 'ha-long' });
    mockCounter = 0;
    onlineManager.setOnline(true);
  });
  afterEach(() => clients.splice(0).forEach((c) => c.clear()));
  afterAll(() => onlineManager.setOnline(true));

  it('hors ligne : le départ attend, puis part UNE fois avec le même id au retour du réseau', async () => {
    const client = makeClient();
    const { result } = await renderHook(() => useStartAdventure(), { wrapper: wrap(client) });
    onlineManager.setOnline(false);
    await act(async () => result.current.mutate(startVars('c1', 'ha-long')));
    expect(mockStart).not.toHaveBeenCalled();
    await act(async () => onlineManager.setOnline(true));
    await act(async () => client.resumePausedMutations());
    await waitFor(() => expect(mockStart).toHaveBeenCalledTimes(1));
    expect(mockStart).toHaveBeenCalledWith('c1', 'adv-1', 'ha-long');
  });

  it('erreurs réseau répétées : chaque essai réutilise le même id d’aventure', async () => {
    mockStart.mockRejectedValueOnce({ message: 'Network request failed' }).mockResolvedValue(undefined);
    const client = makeClient();
    const { result } = await renderHook(() => useStartAdventure(), { wrapper: wrap(client) });
    await act(async () => result.current.mutate(startVars('c1', 'ha-long')));
    await waitFor(() => expect(mockStart).toHaveBeenCalledTimes(2));
    expect(new Set(mockStart.mock.calls.map((c) => c[1]))).toEqual(new Set(['adv-1']));
  });

  it('refus métier (pas encore rentré) : pas de rejeu', async () => {
    mockCollect.mockRejectedValue({ message: 'not_back_yet', code: 'P0001' });
    const client = makeClient();
    const { result } = await renderHook(() => useCollectAdventure(), { wrapper: wrap(client) });
    await act(async () => result.current.mutate({ childId: 'c1', adventureId: 'a1' }));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockCollect).toHaveBeenCalledTimes(1);
  });

  it('récupération : la trouvaille vient de la réponse du serveur', async () => {
    const client = makeClient();
    const { result } = await renderHook(() => useCollectAdventure(), { wrapper: wrap(client) });
    await act(async () => result.current.mutate({ childId: 'c1', adventureId: 'a1' }));
    await waitFor(() => expect(result.current.data).toEqual({ discoverySlug: 'ha-long-perle', duplicate: false, destination: 'ha-long' }));
  });
});

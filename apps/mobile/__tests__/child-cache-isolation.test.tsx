import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { Session } from '@supabase/supabase-js';
import type { ReactNode } from 'react';
import { useAuthListener } from '@/hooks/useMe';
import { useSessionStore } from '@/store/session';
import { createTestQueryClient } from '../test-utils/queryClient';

let mockAuthCallback: ((event: string, session: Session | null) => void) | null = null;
let mockInitialSession: Session | null = null;
jest.mock('@/api/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: mockInitialSession } }),
      onAuthStateChange: (cb: (event: string, session: Session | null) => void) => {
        mockAuthCallback = cb;
        return { data: { subscription: { unsubscribe: jest.fn() } } };
      },
    },
  },
}));
const mockStore = new Map<string, string>();
jest.mock('@/sync/storage', () => ({
  kvStorage: {
    getItem: (k: string) => mockStore.get(k) ?? null,
    setItem: (k: string, v: string) => void mockStore.set(k, v),
    removeItem: (k: string) => void mockStore.delete(k),
  },
}));
const mockRemoveClient = jest.fn();
jest.mock('@/sync/persister', () => ({ persister: { removeClient: () => mockRemoveClient() } }));

const session = (id: string): Session => ({ user: { id } }) as unknown as Session;

describe('cache local : aucune donnée d\'un autre enfant lisible après un changement de compte (D-052)', () => {
  const client = createTestQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  afterAll(() => client.clear());

  const seedParentData = () => {
    client.setQueryData(['me', 'u-parent'], { children: [{ id: 'c-minh' }, { id: 'c-khang' }] });
    client.setQueryData(['tasks', 'c-khang', '2026-07-02'], [{ id: 't-khang', title: 'Tâche de Khang' }]);
    client.setQueryData(['child_balances', 'c-khang'], { balance: 50 });
    // écriture hors ligne en attente (file de mutations) créée par le parent
    client.getMutationCache().build(client, { mutationKey: ['writes'], mutationFn: () => Promise.resolve(), scope: { id: 'writes' } });
    useSessionStore.getState().setDisplayedChildId('c-khang');
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockStore.clear();
    mockInitialSession = null;
    client.clear();
  });

  it('le parent consulte les deux enfants, se déconnecte, l\'enfant se connecte sur le même appareil : tout est purgé', async () => {
    await renderHook(() => useAuthListener(), { wrapper });
    await act(async () => mockAuthCallback?.('SIGNED_IN', session('u-parent')));
    seedParentData();
    expect(client.getQueryCache().getAll().length).toBe(3);
    expect(client.getMutationCache().getAll().length).toBe(1);

    // déconnexion du parent : le cache et la file d'écritures sont vidés, la sélection d'enfant aussi
    await act(async () => mockAuthCallback?.('SIGNED_OUT', null));
    expect(client.getQueryCache().getAll()).toHaveLength(0);
    expect(client.getMutationCache().getAll()).toHaveLength(0);
    expect(useSessionStore.getState().displayedChildId).toBeNull();
    expect(mockRemoveClient).toHaveBeenCalled(); // cache persisté (stockage local) supprimé

    // l'enfant se connecte : rien de ce qu'avait lu le parent n'est lisible
    await act(async () => mockAuthCallback?.('SIGNED_IN', session('u-child')));
    expect(client.getQueryData(['tasks', 'c-khang', '2026-07-02'])).toBeUndefined();
    expect(client.getQueryData(['child_balances', 'c-khang'])).toBeUndefined();
    expect(client.getQueryData(['me', 'u-parent'])).toBeUndefined();
    expect(client.getQueryCache().getAll()).toHaveLength(0);
  });

  it('changement de compte SANS déconnexion intermédiaire (parent → enfant) : purge aussi', async () => {
    await renderHook(() => useAuthListener(), { wrapper });
    await act(async () => mockAuthCallback?.('SIGNED_IN', session('u-parent')));
    seedParentData();
    await act(async () => mockAuthCallback?.('SIGNED_IN', session('u-child')));
    expect(client.getQueryCache().getAll()).toHaveLength(0);
    expect(client.getMutationCache().getAll()).toHaveLength(0);
    expect(useSessionStore.getState().displayedChildId).toBeNull();
  });

  it('relance de l\'application avec un cache laissé par un autre compte : purgé avant tout affichage', async () => {
    mockStore.set('taskmate-last-user', 'u-parent'); // propriétaire du cache restauré
    mockInitialSession = session('u-child'); // session actuellement ouverte : l'enfant
    client.setQueryData(['tasks', 'c-khang', '2026-07-02'], [{ id: 't-khang' }]);
    await renderHook(() => useAuthListener(), { wrapper });
    await act(async () => undefined);
    expect(client.getQueryData(['tasks', 'c-khang', '2026-07-02'])).toBeUndefined();
    expect(mockRemoveClient).toHaveBeenCalled();
  });

  it('même compte qui se reconnecte : le cache est conservé (pas de purge inutile)', async () => {
    await renderHook(() => useAuthListener(), { wrapper });
    await act(async () => mockAuthCallback?.('SIGNED_IN', session('u-child')));
    client.setQueryData(['tasks', 'c-minh', '2026-07-02'], [{ id: 't1' }]);
    await act(async () => mockAuthCallback?.('TOKEN_REFRESHED', session('u-child')));
    expect(client.getQueryData(['tasks', 'c-minh', '2026-07-02'])).toBeDefined();
  });
});

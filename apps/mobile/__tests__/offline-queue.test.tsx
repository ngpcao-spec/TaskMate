import { dehydrate, hydrate, onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import '@/i18n';
import { taskKeys } from '@/api/keys';
import { toggleVars, useCreateTasks, useToggleTask } from '@/hooks/useTasks';
import { mutationKeys, registerMutationDefaults } from '@/sync/mutations';
import type { TaskRow } from '@/types/db';

const mockComplete = jest.fn();
const mockCreate = jest.fn();
jest.mock('@/api/tasks', () => ({
  ...jest.requireActual('@/api/tasks'),
  setTaskCompleted: (...a: unknown[]) => mockComplete(...a),
  createTasks: (...a: unknown[]) => mockCreate(...a),
}));
let mockCounter = 0;
jest.mock('@/api/ids', () => ({ newId: jest.fn(() => `tx-${++mockCounter}`) }));
jest.mock('@/api/supabase', () => ({ supabase: {} }));

const task = { id: 't1', child_id: 'c1', date: '2026-07-02', completed_at: null } as TaskRow;
const key = taskKeys.range('c1', '2026-07-02', '2026-07-02');

const clients: QueryClient[] = [];
const makeClient = () => {
  const client = new QueryClient();
  clients.push(client);
  registerMutationDefaults(client, { retryDelay: () => 0 });
  client.setQueryData<TaskRow[]>(key, [task]);
  return client;
};
const wrap = (client: QueryClient) => {
  const Wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return Wrapper;
};

describe('file d’écritures hors ligne', () => {
  beforeEach(() => {
    mockComplete.mockReset().mockResolvedValue(undefined);
    mockCreate.mockReset().mockResolvedValue(undefined);
    mockCounter = 0;
    onlineManager.setOnline(true);
  });
  afterEach(() => {
    // libère les timers de gc de TanStack (sinon Jest ne se termine pas)
    clients.splice(0).forEach((c) => c.clear());
  });
  afterAll(() => onlineManager.setOnline(true));

  it('hors ligne : UI optimiste immédiate, aucun appel réseau ; au retour du réseau, un seul appel avec le même tx_id', async () => {
    const client = makeClient();
    const { result } = await renderHook(() => useToggleTask(), { wrapper: wrap(client) });
    onlineManager.setOnline(false);

    await act(async () => result.current.mutate(toggleVars(task, true)));
    expect(client.getQueryData<TaskRow[]>(key)?.[0]?.completed_at).not.toBeNull(); // optimiste
    expect(mockComplete).not.toHaveBeenCalled(); // en pause

    await act(async () => onlineManager.setOnline(true));
    await act(async () => client.resumePausedMutations());
    await waitFor(() => expect(mockComplete).toHaveBeenCalledTimes(1));
    expect(mockComplete).toHaveBeenCalledWith('t1', true, 'tx-1');
  });

  it('erreurs réseau répétées : chaque retry réutilise le MÊME tx_id (crédit unique côté serveur)', async () => {
    mockComplete
      .mockRejectedValueOnce({ message: 'Network request failed' })
      .mockRejectedValueOnce({ message: 'Network request failed' })
      .mockResolvedValue(undefined);
    const client = makeClient();
    const { result } = await renderHook(() => useToggleTask(), { wrapper: wrap(client) });
    await act(async () => result.current.mutate(toggleVars(task, true)));
    await waitFor(() => expect(mockComplete).toHaveBeenCalledTimes(3));
    const txIds = mockComplete.mock.calls.map((c) => c[2]);
    expect(new Set(txIds)).toEqual(new Set(['tx-1']));
  });

  it('erreur métier : pas de rejeu', async () => {
    mockComplete.mockRejectedValue({ message: 'forbidden' });
    const client = makeClient();
    const { result } = await renderHook(() => useToggleTask(), { wrapper: wrap(client) });
    await act(async () => result.current.mutate(toggleVars(task, true)));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockComplete).toHaveBeenCalledTimes(1);
  });

  it('les écritures partent dans l’ordre : création avant coche de la même tâche', async () => {
    const order: string[] = [];
    mockCreate.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 20));
      order.push('create');
    });
    mockComplete.mockImplementation(async () => void order.push('complete'));
    const client = makeClient();
    const create = await renderHook(() => useCreateTasks(), { wrapper: wrap(client) });
    const toggle = await renderHook(() => useToggleTask(), { wrapper: wrap(client) });
    const fields = { id: 'n1', child_id: 'c1', title: 'x', category: 'study', note: null, date: '2026-07-02', time_kind: 'anytime', start_time: null, end_time: null, points: 10 } as const;
    await act(async () => {
      create.result.current.mutate({ familyId: 'f1', memberId: 'm1', tasks: [fields] });
      toggle.result.current.mutate(toggleVars({ ...task, id: 'n1' }, true));
    });
    await waitFor(() => expect(order).toEqual(['create', 'complete']));
    // la tâche créée hors ligne apparaît tout de suite dans la liste du jour
    expect(client.getQueryData<TaskRow[]>(key)?.some((t) => t.id === 'n1')).toBe(true);
  });

  it('une écriture en pause survit au redémarrage (persistance) puis est rejouée avec le même tx_id', async () => {
    const first = makeClient();
    const { result } = await renderHook(() => useToggleTask(), { wrapper: wrap(first) });
    onlineManager.setOnline(false);
    await act(async () => result.current.mutate(toggleVars(task, true)));
    const persisted = JSON.parse(JSON.stringify(dehydrate(first)));
    expect(persisted.mutations).toHaveLength(1);
    expect(persisted.mutations[0].mutationKey).toEqual(mutationKeys.toggleTask);

    first.getMutationCache().clear(); // le processus est mort : l'ancien client n'existe plus
    // « redémarrage » : nouveau client, mêmes defaults, état réhydraté
    const second = makeClient();
    hydrate(second, persisted);
    await act(async () => onlineManager.setOnline(true));
    await act(async () => second.resumePausedMutations());
    await waitFor(() => expect(mockComplete).toHaveBeenCalledTimes(1));
    expect(mockComplete).toHaveBeenCalledWith('t1', true, 'tx-1');
  });
});

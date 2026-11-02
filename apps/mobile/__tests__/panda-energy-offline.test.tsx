import { onlineManager, QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { createTestQueryClient } from '../test-utils/queryClient';
import '@/i18n';
import { companionKeys, taskKeys } from '@/api/keys';
import type { CompanionState } from '@/domain/panda';
import { toggleVars, useToggleTask } from '@/hooks/useTasks';
import { registerMutationDefaults } from '@/sync/mutations';
import type { TaskRow } from '@/types/models';

const mockComplete = jest.fn();
jest.mock('@/api/tasks', () => ({ ...jest.requireActual('@/api/tasks'), setTaskCompleted: (...a: unknown[]) => mockComplete(...a) }));
let mockCounter = 0;
jest.mock('@/api/ids', () => ({ newId: jest.fn(() => `tx-${++mockCounter}`) }));
jest.mock('@/api/supabase', () => ({ supabase: {} }));

const task = { id: 't1', child_id: 'c1', date: '2026-07-02', completed_at: null, points: 10 } as TaskRow;
const done = { ...task, completed_at: '2026-07-02T08:00:00Z' } as TaskRow;
const tasksKey = taskKeys.range('c1', '2026-07-02', '2026-07-02');
const state = (energyTotal: number, level = 1, nextLevelAt = 100): CompanionState => ({ hasCompanion: true, name: 'Bambou', trait: 'kind', variant: 'boy', stage: 2, stageOffset: 0, energyTotal, level, nextLevelAt });

const clients: QueryClient[] = [];
const makeClient = (energy = 20) => {
  const client = createTestQueryClient({ defaultOptions: { queries: { retry: undefined } } });
  clients.push(client);
  registerMutationDefaults(client, { retryDelay: () => 0 });
  client.setQueryData<TaskRow[]>(tasksKey, [task]);
  client.setQueryData<CompanionState>(companionKeys.state('c1'), state(energy));
  return client;
};
const wrap = (client: QueryClient) => {
  const Wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return Wrapper;
};
const energyOf = (client: QueryClient) => client.getQueryData<CompanionState>(companionKeys.state('c1'))?.energyTotal;

describe('énergie du panda affichée tout de suite (D-104, D-106 : énergie = points de la tâche)', () => {
  beforeEach(() => {
    mockComplete.mockReset().mockResolvedValue(undefined);
    mockCounter = 0;
    onlineManager.setOnline(true);
  });
  afterEach(() => clients.splice(0).forEach((c) => c.clear()));
  afterAll(() => onlineManager.setOnline(true));

  it('hors ligne : l’enfant coche → + les points de la tâche (10 ⚡) aussitôt, sans appel réseau ; le niveau est recalculé', async () => {
    const client = makeClient(95);
    const { result } = await renderHook(() => useToggleTask(), { wrapper: wrap(client) });
    onlineManager.setOnline(false);
    await act(async () => result.current.mutate(toggleVars(task, true, false)));
    expect(energyOf(client)).toBe(105);
    expect(client.getQueryData<CompanionState>(companionKeys.state('c1'))).toMatchObject({ level: 2, nextLevelAt: 300 });
    expect(mockComplete).not.toHaveBeenCalled();
  });

  it('l’enfant décoche → − les points de la tâche, jamais sous 0', async () => {
    const client = makeClient(3);
    client.setQueryData<TaskRow[]>(tasksKey, [done]);
    const { result } = await renderHook(() => useToggleTask(), { wrapper: wrap(client) });
    onlineManager.setOnline(false);
    await act(async () => result.current.mutate(toggleVars(done, false, false)));
    expect(energyOf(client)).toBe(0);
  });

  it('un parent qui coche ne change pas l’énergie affichée', async () => {
    const client = makeClient(20);
    const { result } = await renderHook(() => useToggleTask(), { wrapper: wrap(client) });
    onlineManager.setOnline(false);
    await act(async () => result.current.mutate(toggleVars(task, true, true)));
    expect(energyOf(client)).toBe(20);
  });

  it('écriture refusée : l’énergie d’avant est rétablie', async () => {
    mockComplete.mockRejectedValue({ message: 'forbidden' });
    const client = makeClient(20);
    const { result } = await renderHook(() => useToggleTask(), { wrapper: wrap(client) });
    await act(async () => result.current.mutate(toggleVars(task, true, false)));
    await waitFor(() => expect(mockComplete).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(energyOf(client)).toBe(20));
  });

  it('sans état de panda en cache : la coche passe sans erreur', async () => {
    const client = makeClient();
    client.removeQueries({ queryKey: companionKeys.state('c1') });
    const { result } = await renderHook(() => useToggleTask(), { wrapper: wrap(client) });
    await act(async () => result.current.mutate(toggleVars(task, true, false)));
    await waitFor(() => expect(mockComplete).toHaveBeenCalledTimes(1));
    expect(energyOf(client)).toBeUndefined();
  });
});

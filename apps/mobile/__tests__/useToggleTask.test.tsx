import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import '@/i18n';
import { taskKeys } from '@/api/keys';
import { toggleVars, useToggleTask } from '@/hooks/useTasks';
import { registerMutationDefaults } from '@/sync/mutations';
import { useToastStore } from '@/store/toast';
import type { TaskRow } from '@/types/db';

const mockSet = jest.fn();
jest.mock('@/api/tasks', () => ({
  ...jest.requireActual('@/api/tasks'),
  setTaskCompleted: (...args: unknown[]) => mockSet(...args),
}));
jest.mock('@/api/ids', () => ({ newId: jest.fn(() => 'tx-fixed') }));
jest.mock('@/api/supabase', () => ({ supabase: {} }));

const task = { id: 't1', child_id: 'c1', completed_at: null } as TaskRow;
const key = taskKeys.range('c1', '2026-07-02', '2026-07-02');

const clients: QueryClient[] = [];
async function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  clients.push(client);
  registerMutationDefaults(client);
  client.setQueryData<TaskRow[]>(key, [task]);
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, ...(await renderHook(() => useToggleTask(), { wrapper })) };
}

describe('useToggleTask', () => {
  afterEach(() => clients.splice(0).forEach((c) => c.clear()));
  beforeEach(() => {
    mockSet.mockReset();
    useToastStore.setState({ toast: null });
  });

  it('coche de façon optimiste puis appelle la RPC avec un tx_id stable', async () => {
    let release: () => void = () => {};
    mockSet.mockReturnValue(new Promise<void>((r) => (release = r)));
    const { client, result } = await setup();
    await act(async () => result.current.mutate(toggleVars(task, true)));
    await waitFor(() => expect(client.getQueryData<TaskRow[]>(key)?.[0]?.completed_at).not.toBeNull());
    expect(mockSet).toHaveBeenCalledWith('t1', true, 'tx-fixed');
    await act(async () => release());
  });

  it('refus serveur (points réservés) : retour arrière et toast', async () => {
    mockSet.mockRejectedValue({ message: 'insufficient_balance' });
    const { client, result } = await setup();
    client.setQueryData<TaskRow[]>(key, [{ ...task, completed_at: 'x' }]);
    await act(async () => result.current.mutate(toggleVars({ ...task, completed_at: 'x' }, false)));
    await waitFor(() => expect(useToastStore.getState().toast?.message).toMatch(/Không thể bỏ chọn/));
    await waitFor(() => expect(client.getQueryData<TaskRow[]>(key)?.[0]?.completed_at).toBe('x'));
  });

  it('tâche supprimée côté parent : retirée de l’UI avec un toast', async () => {
    mockSet.mockRejectedValue({ message: 'task_not_found' });
    const { client, result } = await setup();
    await act(async () => result.current.mutate(toggleVars(task, true)));
    await waitFor(() => expect(useToastStore.getState().toast?.message).toBe('Việc này đã bị xóa'));
    expect(client.getQueryData<TaskRow[]>(key)).toEqual([]);
  });
});

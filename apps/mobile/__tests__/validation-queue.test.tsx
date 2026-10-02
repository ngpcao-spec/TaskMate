import { dehydrate, hydrate, onlineManager, QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import '@/i18n';
import { taskKeys } from '@/api/keys';
import { toggleVars, useRejectTask, useToggleTask, useValidateTask, validateVars } from '@/hooks/useTasks';
import { registerMutationDefaults } from '@/sync/mutations';
import type { TaskRow } from '@/types/models';
import { createTestQueryClient } from '../test-utils/queryClient';

const mockComplete = jest.fn();
const mockValidate = jest.fn();
const mockReject = jest.fn();
jest.mock('@/api/tasks', () => ({
  ...jest.requireActual('@/api/tasks'),
  setTaskCompleted: (...a: unknown[]) => mockComplete(...a),
  validateTaskRpc: (...a: unknown[]) => mockValidate(...a),
  rejectTaskRpc: (...a: unknown[]) => mockReject(...a),
}));
let mockCounter = 0;
jest.mock('@/api/ids', () => ({ newId: jest.fn(() => `tx-${++mockCounter}`) }));
jest.mock('@/api/supabase', () => ({ supabase: {} }));

const base = { id: 't1', child_id: 'c1', date: '2026-07-02', points: 10, completed_at: null, validated_at: null } as TaskRow;
const pendingTask = { ...base, completed_at: '2026-07-02T01:00:00Z' } as TaskRow;
const key = taskKeys.range('c1', '2026-07-02', '2026-07-02');

const clients: QueryClient[] = [];
const makeClient = (initial: TaskRow[]) => {
  const client = createTestQueryClient();
  clients.push(client);
  registerMutationDefaults(client, { retryDelay: () => 0 });
  client.setQueryData<TaskRow[]>(key, initial);
  client.setQueryData<TaskRow[]>(taskKeys.pending, initial.filter((t) => t.completed_at && !t.validated_at));
  return client;
};
const wrap = (client: QueryClient) => {
  const Wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return Wrapper;
};
const cached = (c: QueryClient) => c.getQueryData<TaskRow[]>(key)?.[0];

describe('validation parentale — file hors ligne (SPEC v4 §5.2)', () => {
  beforeEach(() => {
    [mockComplete, mockValidate, mockReject].forEach((m) => m.mockReset().mockResolvedValue(undefined));
    mockCounter = 0;
    onlineManager.setOnline(true);
  });
  afterEach(() => clients.splice(0).forEach((c) => c.clear()));
  afterAll(() => onlineManager.setOnline(true));

  it('coche ENFANT : tâche en attente, jamais validée, aucun crédit optimiste', async () => {
    const client = makeClient([base]);
    const { result } = await renderHook(() => useToggleTask(), { wrapper: wrap(client) });
    onlineManager.setOnline(false);
    await act(async () => result.current.mutate(toggleVars(base, true, false)));
    expect(cached(client)?.completed_at).not.toBeNull();
    expect(cached(client)?.validated_at).toBeNull();
    expect(mockComplete).not.toHaveBeenCalled();
  });

  it('coche PARENT : validée d’office dans l’UI', async () => {
    const client = makeClient([base]);
    const { result } = await renderHook(() => useToggleTask(), { wrapper: wrap(client) });
    onlineManager.setOnline(false);
    await act(async () => result.current.mutate(toggleVars(base, true, true)));
    expect(cached(client)?.validated_at).not.toBeNull();
  });

  it('valider hors ligne : UI optimiste, puis un seul appel avec le même tx_id au retour du réseau', async () => {
    const client = makeClient([pendingTask]);
    const { result } = await renderHook(() => useValidateTask(), { wrapper: wrap(client) });
    onlineManager.setOnline(false);
    await act(async () => result.current.mutate(validateVars(pendingTask)));
    expect(cached(client)?.validated_at).not.toBeNull();
    expect(client.getQueryData<TaskRow[]>(taskKeys.pending)).toEqual([]); // sort de la file
    expect(mockValidate).not.toHaveBeenCalled();
    await act(async () => onlineManager.setOnline(true));
    await act(async () => client.resumePausedMutations());
    await waitFor(() => expect(mockValidate).toHaveBeenCalledTimes(1));
    expect(mockValidate).toHaveBeenCalledWith('t1', 'tx-1');
  });

  it('erreurs réseau : chaque retry de la validation réutilise le même tx_id (un seul crédit côté serveur)', async () => {
    mockValidate.mockRejectedValueOnce({ message: 'Network request failed' }).mockRejectedValueOnce({ message: 'Network request failed' }).mockResolvedValue(undefined);
    const client = makeClient([pendingTask]);
    const { result } = await renderHook(() => useValidateTask(), { wrapper: wrap(client) });
    await act(async () => result.current.mutate(validateVars(pendingTask)));
    await waitFor(() => expect(mockValidate).toHaveBeenCalledTimes(3));
    expect(new Set(mockValidate.mock.calls.map((c) => c[1]))).toEqual(new Set(['tx-1']));
  });

  it('validation refusée par le serveur (décochée entre-temps) : retour arrière + message, pas de rejeu', async () => {
    mockValidate.mockRejectedValue({ message: 'not_pending' });
    const client = makeClient([pendingTask]);
    const { result } = await renderHook(() => useValidateTask(), { wrapper: wrap(client) });
    await act(async () => result.current.mutate(validateVars(pendingTask)));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockValidate).toHaveBeenCalledTimes(1);
    expect(cached(client)?.validated_at).toBeNull();
  });

  it('refuser : retour à faire avec le motif, aucun point', async () => {
    const client = makeClient([pendingTask]);
    const { result } = await renderHook(() => useRejectTask(), { wrapper: wrap(client) });
    onlineManager.setOnline(false);
    await act(async () => result.current.mutate({ task: pendingTask, note: 'à refaire' }));
    expect(cached(client)).toMatchObject({ completed_at: null, rejection_note: 'à refaire' });
    await act(async () => onlineManager.setOnline(true));
    await act(async () => client.resumePausedMutations());
    await waitFor(() => expect(mockReject).toHaveBeenCalledWith('t1', 'à refaire'));
  });

  it('enfant qui décoche une tâche validée entre-temps : already_validated → état validé rétabli', async () => {
    mockComplete.mockRejectedValue({ message: 'already_validated' });
    const validated = { ...pendingTask, validated_at: '2026-07-02T02:00:00Z' } as TaskRow;
    const client = makeClient([validated]);
    const { result } = await renderHook(() => useToggleTask(), { wrapper: wrap(client) });
    await act(async () => result.current.mutate(toggleVars(validated, false, false)));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(cached(client)?.validated_at).toBe('2026-07-02T02:00:00Z');
    expect(cached(client)?.completed_at).not.toBeNull();
  });

  it('une validation en pause survit au redémarrage puis est rejouée avec le même tx_id', async () => {
    const first = makeClient([pendingTask]);
    const { result } = await renderHook(() => useValidateTask(), { wrapper: wrap(first) });
    onlineManager.setOnline(false);
    await act(async () => result.current.mutate(validateVars(pendingTask)));
    const persisted = JSON.parse(JSON.stringify(dehydrate(first)));
    expect(persisted.mutations).toHaveLength(1);
    first.getMutationCache().clear();
    const second = makeClient([pendingTask]);
    hydrate(second, persisted);
    await act(async () => onlineManager.setOnline(true));
    await act(async () => second.resumePausedMutations());
    await waitFor(() => expect(mockValidate).toHaveBeenCalledTimes(1));
    expect(mockValidate).toHaveBeenCalledWith('t1', 'tx-1');
  });
});

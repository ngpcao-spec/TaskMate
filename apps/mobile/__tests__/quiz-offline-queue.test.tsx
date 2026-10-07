import { onlineManager, QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { createTestQueryClient } from '../test-utils/queryClient';
import '@/i18n';
import { useStartQuizEvaluation, useSubmitQuizEvaluation } from '@/hooks/useQuizzes';
import { registerMutationDefaults } from '@/sync/mutations';

const mockStart = jest.fn();
const mockSubmit = jest.fn();
jest.mock('@/api/quizzes', () => ({
  ...jest.requireActual('@/api/quizzes'),
  startQuizEvaluation: (...a: unknown[]) => mockStart(...a),
  submitQuizEvaluation: (...a: unknown[]) => mockSubmit(...a),
}));
jest.mock('@/api/supabase', () => ({ supabase: {} }));

const clients: QueryClient[] = [];
const makeClient = () => {
  const client = createTestQueryClient({ defaultOptions: { queries: { retry: undefined } } });
  clients.push(client);
  registerMutationDefaults(client, { retryDelay: () => 0 });
  return client;
};
const wrap = (client: QueryClient) => {
  const Wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return Wrapper;
};

describe('Révisions — file d\'écritures hors ligne', () => {
  beforeEach(() => { mockStart.mockReset().mockResolvedValue(undefined); mockSubmit.mockReset().mockResolvedValue(undefined); onlineManager.setOnline(true); });
  afterEach(() => { clients.splice(0).forEach((c) => c.clear()); });
  afterAll(() => onlineManager.setOnline(true));

  it('hors ligne : démarrage puis envoi restent en file ; au retour du réseau ils partent dans l\'ordre, avec les MÊMES ids', async () => {
    const client = makeClient();
    const { result } = await renderHook(() => ({ start: useStartQuizEvaluation(), submit: useSubmitQuizEvaluation() }), { wrapper: wrap(client) });
    onlineManager.setOnline(false);
    await act(async () => result.current.start.mutate({ setId: 's1', attemptId: 'att-1' }));
    await act(async () => result.current.submit.mutate({ attemptId: 'att-1', answers: [{ question_id: 'q1', choice: 1 }] }));
    expect(mockStart).not.toHaveBeenCalled();
    expect(mockSubmit).not.toHaveBeenCalled();

    await act(async () => onlineManager.setOnline(true));
    await act(async () => client.resumePausedMutations());
    await waitFor(() => expect(mockSubmit).toHaveBeenCalledTimes(1));
    expect(mockStart).toHaveBeenCalledWith('s1', 'att-1');
    expect(mockSubmit).toHaveBeenCalledWith('att-1', [{ question_id: 'q1', choice: 1 }]);
    expect(mockStart.mock.invocationCallOrder[0]).toBeLessThan(mockSubmit.mock.invocationCallOrder[0] as number);
  });

  it('erreur réseau répétée : chaque rejeu réutilise le même identifiant de tentative (le serveur ignore le double envoi)', async () => {
    mockSubmit.mockRejectedValueOnce({ message: 'Network request failed' }).mockResolvedValue(undefined);
    const client = makeClient();
    const { result } = await renderHook(() => useSubmitQuizEvaluation(), { wrapper: wrap(client) });
    await act(async () => result.current.mutate({ attemptId: 'att-2', answers: [] }));
    await waitFor(() => expect(mockSubmit).toHaveBeenCalledTimes(2));
    expect(new Set(mockSubmit.mock.calls.map((c) => c[0]))).toEqual(new Set(['att-2']));
  });
});

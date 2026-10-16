import { onlineManager, QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { createTestQueryClient } from '../test-utils/queryClient';
import '@/i18n';
import { useSaveQuizProgress, useStartQuizEvaluation, useSubmitQuizEvaluation } from '@/hooks/useQuizzes';
import { registerMutationDefaults } from '@/sync/mutations';

const mockStart = jest.fn();
const mockSubmit = jest.fn();
const mockSave = jest.fn();
jest.mock('@/api/quizzes', () => ({
  ...jest.requireActual('@/api/quizzes'),
  startQuizEvaluation: (...a: unknown[]) => mockStart(...a),
  submitQuizEvaluation: (...a: unknown[]) => mockSubmit(...a),
  saveQuizProgress: (...a: unknown[]) => mockSave(...a),
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
  beforeEach(() => { mockStart.mockReset().mockResolvedValue(undefined); mockSubmit.mockReset().mockResolvedValue(undefined); mockSave.mockReset().mockResolvedValue(undefined); onlineManager.setOnline(true); });
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

  it('Quiz de la semaine : les réponses enregistrées hors ligne partent dans l\'ordre (démarrage → réponses → envoi), avec les MÊMES ids', async () => {
    const client = makeClient();
    const { result } = await renderHook(() => ({ start: useStartQuizEvaluation(), save: useSaveQuizProgress(), submit: useSubmitQuizEvaluation() }), { wrapper: wrap(client) });
    onlineManager.setOnline(false);
    await act(async () => result.current.start.mutate({ setId: 's1', attemptId: 'att-3' }));
    await act(async () => result.current.save.mutate({ attemptId: 'att-3', questionId: 'q1', choice: 2 }));
    await act(async () => result.current.save.mutate({ attemptId: 'att-3', questionId: 'q2', choice: null }));
    await act(async () => result.current.submit.mutate({ attemptId: 'att-3', answers: [] }));
    expect(mockSave).not.toHaveBeenCalled();

    await act(async () => onlineManager.setOnline(true));
    await act(async () => client.resumePausedMutations());
    await waitFor(() => expect(mockSubmit).toHaveBeenCalledTimes(1));
    expect(mockSave.mock.calls).toEqual([['att-3', 'q1', 2], ['att-3', 'q2', null]]);
    const order = [mockStart, mockSave, mockSave, mockSubmit].map((m, i) => m.mock.invocationCallOrder[i === 2 ? 1 : 0] as number);
    expect([...order].sort((a, b) => a - b)).toEqual(order); // démarrage < réponse 1 < réponse 2 < envoi
  });

  it('une réponse rejouée après une erreur réseau garde les mêmes arguments (écriture idempotente côté serveur)', async () => {
    mockSave.mockRejectedValueOnce({ message: 'Network request failed' }).mockResolvedValue(undefined);
    const client = makeClient();
    const { result } = await renderHook(() => useSaveQuizProgress(), { wrapper: wrap(client) });
    await act(async () => result.current.mutate({ attemptId: 'att-4', questionId: 'q1', choice: 1 }));
    await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(2));
    expect(mockSave.mock.calls[0]).toEqual(mockSave.mock.calls[1]);
  });

  it('enregistrer une réponse ne rafraîchit pas tous les écrans de révisions (une écriture par tap)', async () => {
    const client = makeClient();
    const spy = jest.spyOn(client, 'invalidateQueries');
    const { result } = await renderHook(() => useSaveQuizProgress(), { wrapper: wrap(client) });
    await act(async () => result.current.mutate({ attemptId: 'att-5', questionId: 'q1', choice: 0 }));
    await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(1));
    expect(spy).not.toHaveBeenCalled();
  });
});

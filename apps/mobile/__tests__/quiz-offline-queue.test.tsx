import { onlineManager, QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { createTestQueryClient } from '../test-utils/queryClient';
import '@/i18n';
import { useSaveQuizProgress, useStartQuizEvaluation, useSubmitQuizEvaluation, useValidateQuizAttempt } from '@/hooks/useQuizzes';
import { useToastStore } from '@/store/toast';
import { registerMutationDefaults } from '@/sync/mutations';

const mockStart = jest.fn();
const mockSubmit = jest.fn();
const mockSave = jest.fn();
const mockValidate = jest.fn();
jest.mock('@/api/quizzes', () => ({
  ...jest.requireActual('@/api/quizzes'),
  startQuizEvaluation: (...a: unknown[]) => mockStart(...a),
  submitQuizEvaluation: (...a: unknown[]) => mockSubmit(...a),
  saveQuizProgress: (...a: unknown[]) => mockSave(...a),
  validateQuizAttempt: (...a: unknown[]) => mockValidate(...a),
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
    expect(mockStart).toHaveBeenCalledWith('s1', 'att-1', undefined); // sans source : jeu de famille (mutations déjà en file avant D-080)
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

  // D-091 : un QCM supprimé définitivement par l'administrateur pendant qu'une écriture attendait dans la file (enfant hors ligne, parent sur le point de valider)
  describe('QCM supprimé définitivement : l\'écriture en attente échoue en silence et sort de la file', () => {
    beforeEach(() => { mockValidate.mockReset(); useToastStore.getState().dismiss(); });
    const gone = (code: string) => ({ message: code, code: 'P0002' });

    it.each([
      ['réponse enregistrée', 'attempt_not_found', (r: { save: ReturnType<typeof useSaveQuizProgress> }) => r.save.mutate({ attemptId: 'att-6', questionId: 'q1', choice: 1 }), () => mockSave],
      ['envoi de l\'évaluation', 'attempt_not_found', (r: { submit: ReturnType<typeof useSubmitQuizEvaluation> }) => r.submit.mutate({ attemptId: 'att-6', answers: [] }), () => mockSubmit],
      ['démarrage de l\'évaluation', 'set_not_found', (r: { start: ReturnType<typeof useStartQuizEvaluation> }) => r.start.mutate({ setId: 'z1', attemptId: 'att-6', source: 'catalog' }), () => mockStart],
      ['validation par le parent', 'attempt_not_found', (r: { validate: ReturnType<typeof useValidateQuizAttempt> }) => r.validate.mutate({ attemptId: 'att-6' }), () => mockValidate],
    ] as const)('%s : aucun message d\'erreur, aucun rejeu, listes relues', async (_name, code, fire, spy) => {
      spy().mockRejectedValue(gone(code));
      const client = makeClient();
      const invalidate = jest.spyOn(client, 'invalidateQueries');
      const { result } = await renderHook(() => ({ save: useSaveQuizProgress(), submit: useSubmitQuizEvaluation(), start: useStartQuizEvaluation(), validate: useValidateQuizAttempt() }), { wrapper: wrap(client) });
      await act(async () => (fire as (r: typeof result.current) => void)(result.current));
      await waitFor(() => expect(spy()).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['quiz'] }));
      expect(useToastStore.getState().toast).toBeNull();
      expect(spy()).toHaveBeenCalledTimes(1); // définitif : pas de nouvel essai
    });

    it('la file continue : l\'écriture suivante (autre tentative) part normalement après celle d\'un QCM supprimé', async () => {
      mockSave.mockRejectedValueOnce(gone('attempt_not_found')).mockResolvedValue(undefined);
      const client = makeClient();
      const { result } = await renderHook(() => useSaveQuizProgress(), { wrapper: wrap(client) });
      onlineManager.setOnline(false);
      await act(async () => result.current.mutate({ attemptId: 'att-gone', questionId: 'q1', choice: 0 }));
      await act(async () => result.current.mutate({ attemptId: 'att-ok', questionId: 'q1', choice: 2 }));
      await act(async () => onlineManager.setOnline(true));
      await act(async () => client.resumePausedMutations());
      await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(2));
      expect(mockSave.mock.calls.map((c) => c[0])).toEqual(['att-gone', 'att-ok']);
      expect(useToastStore.getState().toast).toBeNull();
    });

    it('toute AUTRE erreur définitive garde son message (rien de masqué)', async () => {
      mockSave.mockRejectedValue({ message: 'attempt_closed', code: 'P0001' });
      const client = makeClient();
      const { result } = await renderHook(() => useSaveQuizProgress(), { wrapper: wrap(client) });
      await act(async () => result.current.mutate({ attemptId: 'att-7', questionId: 'q1', choice: 1 }));
      await waitFor(() => expect(useToastStore.getState().toast).not.toBeNull());
      expect(useToastStore.getState().toast?.tone).toBe('error');
    });
  });
});

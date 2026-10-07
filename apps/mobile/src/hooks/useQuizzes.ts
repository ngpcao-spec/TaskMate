import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { quizKeys } from '@/api/keys';
import {
  checkQuizAnswer, copyQuizSet, deleteQuestion, deleteQuizSet, fetchAttemptDetail, fetchChildAttempts, fetchChildHistory, fetchChildQuestions, fetchChildQuizSets,
  fetchChildResult, fetchParentQuestions, fetchPendingQuizAttempts, fetchQuizSet, fetchQuizSets, fetchSetAttempts, finishQuizPractice, relaunchQuizEvaluation,
  reorderQuestions, setQuizStatus, startQuizPractice, updateQuizSet, upsertQuestion, type QuestionInput,
} from '@/api/quizzes';
import { serverErrorCode } from '@/api/tasks';
import { quizErrorKey } from '@/domain/quiz';
import i18n from '@/i18n';
import { mutationKeys, type CreateQuizSetVars, type StartEvaluationVars, type SubmitEvaluationVars, type ValidateAttemptVars } from '@/sync/mutations';
import { useToastStore } from '@/store/toast';

// ───────────── lectures ─────────────
// staleTime 0 : un résultat soumis ou validé doit apparaître dès l'ouverture de l'écran (le cache persisté ne doit pas masquer l'état courant).
export const useQuizSets = (childId: string | null, enabled = true) => useQuery({ queryKey: quizKeys.sets(childId), queryFn: () => fetchQuizSets(childId), enabled, staleTime: 0 });
export const useQuizSet = (id: string) => useQuery({ queryKey: quizKeys.set(id), queryFn: () => fetchQuizSet(id), enabled: !!id, staleTime: 0 });
export const useParentQuestions = (setId: string) => useQuery({ queryKey: quizKeys.questions(setId), queryFn: () => fetchParentQuestions(setId), enabled: !!setId, staleTime: 0 });
export const useSetAttempts = (setId: string) => useQuery({ queryKey: quizKeys.attempts(setId), queryFn: () => fetchSetAttempts(setId), enabled: !!setId, staleTime: 0 });
export const useChildAttempts = (childId: string | null) => useQuery({ queryKey: quizKeys.childAttempts(childId ?? 'none'), queryFn: () => fetchChildAttempts(childId as string), enabled: childId !== null, staleTime: 0 });
export const usePendingQuizAttempts = (enabled: boolean) => useQuery({ queryKey: quizKeys.pending, queryFn: fetchPendingQuizAttempts, enabled, staleTime: 0 });
export const useAttemptDetail = (id: string) => useQuery({ queryKey: quizKeys.detail(id), queryFn: () => fetchAttemptDetail(id), enabled: !!id, staleTime: 0 });

export const useChildQuizSets = (enabled = true) => useQuery({ queryKey: quizKeys.mine, queryFn: fetchChildQuizSets, enabled, staleTime: 0 });
export const useChildQuestions = (setId: string) => useQuery({ queryKey: quizKeys.play(setId), queryFn: () => fetchChildQuestions(setId), enabled: !!setId, staleTime: Infinity });
export const useChildResult = (attemptId: string) => useQuery({ queryKey: quizKeys.result(attemptId), queryFn: () => fetchChildResult(attemptId), enabled: !!attemptId, staleTime: 0 });
export const useChildHistory = (setId: string) => useQuery({ queryKey: quizKeys.history(setId), queryFn: () => fetchChildHistory(setId), enabled: !!setId, staleTime: 0 });

// ───────────── écritures mises en file (sync/mutations.ts : scope `writes`, rejeu idempotent) ─────────────
export const useCreateQuizSet = () => useMutation<void, unknown, CreateQuizSetVars>({ mutationKey: mutationKeys.createQuizSet });
export const useStartQuizEvaluation = () => useMutation<void, unknown, StartEvaluationVars>({ mutationKey: mutationKeys.startQuizEvaluation });
export const useSubmitQuizEvaluation = () => useMutation<void, unknown, SubmitEvaluationVars>({ mutationKey: mutationKeys.submitQuizEvaluation });
export const useValidateQuizAttempt = () => useMutation<void, unknown, ValidateAttemptVars>({ mutationKey: mutationKeys.validateQuizAttempt });

// ───────────── écritures en ligne (édition des questions, publication, copie… ; ids fixés par l'écran) ─────────────
function useOnlineQuizMutation<V, R = void>(fn: (v: V) => Promise<R>, invalidate = true) {
  const queryClient = useQueryClient();
  const show = useToastStore((s) => s.show);
  return useMutation<R, unknown, V>({
    networkMode: 'always',
    mutationFn: fn,
    onError: (error) => show(i18n.t(quizErrorKey(serverErrorCode(error))), 'error'),
    onSettled: () => {
      if (invalidate) void queryClient.invalidateQueries({ queryKey: quizKeys.all });
    },
  });
}

export const useUpsertQuestion = () => useOnlineQuizMutation<QuestionInput>(upsertQuestion);
export const useDeleteQuestion = () => useOnlineQuizMutation<string>(deleteQuestion);
export const useReorderQuestions = () => useOnlineQuizMutation<{ setId: string; ids: string[] }>(({ setId, ids }) => reorderQuestions(setId, ids));
export const useSetQuizStatus = () => useOnlineQuizMutation<{ setId: string; status: 'draft' | 'published' }>(({ setId, status }) => setQuizStatus(setId, status));
export const useCopyQuizSet = () => useOnlineQuizMutation<{ source: string; newSet: string; childId: string }>(({ source, newSet, childId }) => copyQuizSet(source, newSet, childId));
export const useRelaunchEvaluation = () => useOnlineQuizMutation<{ setId: string; attemptId: string }>(({ setId, attemptId }) => relaunchQuizEvaluation(setId, attemptId));
export const useUpdateQuizSet = () => useOnlineQuizMutation<{ id: string; patch: { title?: string; subject?: string | null } }>(({ id, patch }) => updateQuizSet(id, patch));
export const useDeleteQuizSet = () => useOnlineQuizMutation<string>(deleteQuizSet);

// entraînement : appels en ligne, sans invalidation à chaque réponse
export const useStartPractice = () => useOnlineQuizMutation<{ setId: string; attemptId: string }>(({ setId, attemptId }) => startQuizPractice(setId, attemptId), false);
export const useCheckAnswer = () => useOnlineQuizMutation<{ attemptId: string; questionId: string; choice: number }, Awaited<ReturnType<typeof checkQuizAnswer>>>(({ attemptId, questionId, choice }) => checkQuizAnswer(attemptId, questionId, choice), false);
export const useFinishPractice = () => useOnlineQuizMutation<string, Awaited<ReturnType<typeof finishQuizPractice>>>(finishQuizPractice);

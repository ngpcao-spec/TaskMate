import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  confirmCatalogAnswers, createCatalogDraft, createCatalogQuiz, deleteCatalogQuestion, deleteCatalogQuiz, fetchCatalogList, fetchCatalogQuestions, fetchCatalogQuiz, fetchChildSubjects, fetchIsPlatformAdmin,
  fetchParentCatalog, fetchParentQuizDetail, relaunchCatalogEvaluation, reorderCatalogQuestions, setCatalogDates, setCatalogKind, setCatalogPaper, setCatalogStatus, setChildClass, setChildSubject,
  shiftChildSubject, updateCatalogInfo, upsertCatalogQuestion, type CatalogQuestionInput, type NewCatalogQuiz,
} from '@/api/catalog';
import { platformKeys, queryKeys, quizKeys } from '@/api/keys';
import { draftQuestions } from '@/domain/catalog-import';
import type { ExistingQuiz, PublishResult, StepResult, WriteStep } from '@/domain/catalog-import-plan';
import { serverErrorCode } from '@/api/tasks';
import { quizErrorKey } from '@/domain/quiz';
import i18n from '@/i18n';
import { useToastStore } from '@/store/toast';
import type { QuizMaterialKind, QuizStatus } from '@/types/models';

/** Entrée de menu « Administration » : affichée seulement si la BASE dit que l'appelant est administrateur (chaque RPC `catalog_*` le revérifie). */
export const useIsPlatformAdmin = () => useQuery({ queryKey: platformKeys.isAdmin, queryFn: fetchIsPlatformAdmin, staleTime: 5 * 60_000 });

// ───────────── administrateur : lectures ─────────────
export const useCatalogList = (enabled = true) => useQuery({ queryKey: quizKeys.catalogList, queryFn: fetchCatalogList, enabled, staleTime: 0 });
export const useCatalogQuiz = (id: string) => useQuery({ queryKey: quizKeys.catalogQuiz(id), queryFn: () => fetchCatalogQuiz(id), enabled: !!id, staleTime: 0 });
export const useCatalogQuestions = (id: string) => useQuery({ queryKey: quizKeys.catalogQuestions(id), queryFn: () => fetchCatalogQuestions(id), enabled: !!id, staleTime: 0 });

// ───────────── parent : lectures ─────────────
export const useChildSubjects = (childId: string | null) => useQuery({ queryKey: quizKeys.childSubjects(childId ?? 'none'), queryFn: () => fetchChildSubjects(childId as string), enabled: childId !== null, staleTime: 0 });
/** Détail d'un quiz pour le parent (D-089) ; `staleTime: 0` : une tentative envoyée ou validée doit apparaître dès l'ouverture. */
export const useParentQuizDetail = (childId: string | null, quizId: string | null) =>
  useQuery({ queryKey: quizKeys.parentDetail(childId ?? 'none', quizId ?? 'none'), queryFn: () => fetchParentQuizDetail(childId as string, quizId as string), enabled: !!childId && !!quizId, staleTime: 0, retry: false });
export const useParentCatalog = (childId: string | null) => useQuery({ queryKey: quizKeys.parentCatalog(childId ?? 'none'), queryFn: () => fetchParentCatalog(childId as string), enabled: childId !== null, staleTime: 0 });

/** Écritures en ligne (comme l'édition des révisions) : message d'erreur traduit, rafraîchissement des révisions. */
function useCatalogMutation<V, R = void>(fn: (v: V) => Promise<R>, alsoInvalidate: readonly (readonly unknown[])[] = []) {
  const queryClient = useQueryClient();
  const show = useToastStore((s) => s.show);
  return useMutation<R, unknown, V>({
    networkMode: 'always',
    mutationFn: fn,
    onError: (error) => show(i18n.t(quizErrorKey(serverErrorCode(error))), 'error'),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: quizKeys.all });
      for (const key of alsoInvalidate) void queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

export const useCreateCatalogQuiz = () => useCatalogMutation<NewCatalogQuiz>(createCatalogQuiz);
export const useUpsertCatalogQuestion = () => useCatalogMutation<CatalogQuestionInput>(upsertCatalogQuestion);
export const useDeleteCatalogQuestion = () => useCatalogMutation<string>(deleteCatalogQuestion);
export const useReorderCatalogQuestions = () => useCatalogMutation<{ quizId: string; ids: string[] }>(({ quizId, ids }) => reorderCatalogQuestions(quizId, ids));
export const useConfirmCatalogAnswers = () => useCatalogMutation<{ quizId: string; answers: { question_id: string; correct: number }[] }>(({ quizId, answers }) => confirmCatalogAnswers(quizId, answers));
export const useUpdateCatalogInfo = () => useCatalogMutation<{ quizId: string; week: string; title: string }>(({ quizId, week, title }) => updateCatalogInfo(quizId, week, title));
export const useSetCatalogKind = () => useCatalogMutation<{ quizId: string; kind: QuizMaterialKind }>(({ quizId, kind }) => setCatalogKind(quizId, kind));
export const useSetCatalogPaper = () => useCatalogMutation<{ quizId: string; paper: boolean; sheetOnly: boolean }>(({ quizId, paper, sheetOnly }) => setCatalogPaper(quizId, paper, sheetOnly));
export const useSetCatalogDates = () => useCatalogMutation<{ quizId: string; releaseOn: string | null; dueOn: string | null }>(({ quizId, releaseOn, dueOn }) => setCatalogDates(quizId, releaseOn, dueOn));
export const useSetCatalogStatus = () => useCatalogMutation<{ quizId: string; status: QuizStatus }>(({ quizId, status }) => setCatalogStatus(quizId, status));
export const useDeleteCatalogQuiz = () => useCatalogMutation<string>(deleteCatalogQuiz);

export const useSetChildClass = () => useCatalogMutation<{ childId: string; country: string; grade: string }>(({ childId, country, grade }) => setChildClass(childId, country, grade), [queryKeys.me]);
export const useSetChildSubject = () => useCatalogMutation<{ childId: string; subject: string; active: boolean }>(({ childId, subject, active }) => setChildSubject(childId, subject, active));
export const useShiftChildSubject = () => useCatalogMutation<{ childId: string; subject: string; delta: -1 | 1 }>(({ childId, subject, delta }) => shiftChildSubject(childId, subject, delta));
export const useRelaunchCatalogEvaluation = () => useCatalogMutation<{ quizId: string; childId: string; attemptId: string }>(({ quizId, childId, attemptId }) => relaunchCatalogEvaluation(quizId, childId, attemptId));

/**
 * Import d'administration « un seul fichier » (D-081) : écritures SÉQUENTIELLES, une transaction par QCM côté base (brouillon + dates), rejouables (ids fixés par le plan).
 * Une erreur sur un QCM n'empêche pas les suivants et n'annule pas les précédents ; elle est rapportée avec son code serveur. Rien ne passe hors des RPC d'administration.
 */
export function useCatalogBulk() {
  const queryClient = useQueryClient();
  const refresh = () => void queryClient.invalidateQueries({ queryKey: quizKeys.all });
  const loadExisting = async (): Promise<ExistingQuiz[]> => {
    const rows = await queryClient.fetchQuery({ queryKey: quizKeys.catalogList, queryFn: fetchCatalogList, staleTime: 0 });
    return rows.map((r) => ({ id: r.id, country: r.country, grade: r.grade, subject: r.subject, week_label: r.week_label, status: r.status, attempts_count: r.attempts_count, title: r.title }));
  };
  const write = async (steps: readonly WriteStep[], onProgress?: (done: number, total: number) => void): Promise<StepResult[]> => {
    const out: StepResult[] = [];
    for (const { item, replace } of steps) {
      const q = item.quiz;
      try {
        await createCatalogDraft({ id: item.id, country: q.country, grade: q.grade, subject: q.subject, week: q.week, title: q.title, questions: draftQuestions(q), releaseOn: q.releaseOn, dueOn: q.dueOn, replace });
        out.push({ block: q.block, id: item.id, outcome: replace ? 'replaced' : 'created' });
      } catch (error) {
        out.push({ block: q.block, id: item.id, outcome: 'failed', error: serverErrorCode(error) });
      }
      onProgress?.(out.length, steps.length);
    }
    refresh();
    return out;
  };
  const publish = async (items: readonly { block: number; id: string }[], onProgress?: (done: number, total: number) => void): Promise<PublishResult[]> => {
    const out: PublishResult[] = [];
    for (const it of items) {
      try {
        await setCatalogStatus(it.id, 'published'); // mêmes règles que la publication à la main (D-061 + dates) : refus = reste en brouillon, avec la raison
        out.push({ block: it.block, id: it.id, outcome: 'published' });
      } catch (error) {
        out.push({ block: it.block, id: it.id, outcome: 'draft', error: serverErrorCode(error) });
      }
      onProgress?.(out.length, items.length);
    }
    refresh();
    return out;
  };
  return { loadExisting, write, publish };
}

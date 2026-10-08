import type { QuizAttemptRow, QuizAttemptStatus, QuizMaterialKind, QuizQuestionRow, QuizSetRow } from '@/types/models';
import { supabase } from './supabase';

/** Révisions (D-055). Parent : lectures directes (RLS) + RPC ; enfant : RPC uniquement (jamais la clé des réponses). */

const fail = (error: { message: string } | null): void => {
  if (error) throw error;
};

// ───────────── parent : lecture ─────────────
export type QuizSetWithCount = QuizSetRow & { question_count: number };

export async function fetchQuizSets(childId: string | null): Promise<QuizSetWithCount[]> {
  let query = supabase.from('quiz_sets').select('*, quiz_questions(count)').is('deleted_at', null).order('created_at', { ascending: false });
  if (childId) query = query.eq('child_id', childId);
  const { data, error } = await query;
  fail(error);
  return (data ?? []).map(({ quiz_questions, ...set }) => ({ ...(set as QuizSetRow), question_count: (quiz_questions as { count: number }[] | null)?.[0]?.count ?? 0 }));
}

export async function fetchQuizSet(id: string): Promise<QuizSetRow | null> {
  const { data, error } = await supabase.from('quiz_sets').select('*').eq('id', id).is('deleted_at', null).maybeSingle();
  fail(error);
  return data;
}

/** Question vue par le PARENT : énoncé, numéro d'origine, signalements, clé (réponse, explication, « à vérifier », confirmée). Jamais lisible par l'enfant. */
export type ParentQuestion = QuizQuestionRow & { correct_index: number; explanation: string | null; to_verify: boolean; confirmed: boolean };

export async function fetchParentQuestions(setId: string): Promise<ParentQuestion[]> {
  const { data, error } = await supabase.from('quiz_questions').select('*, quiz_answer_keys(correct_index, explanation, to_verify, confirmed)').eq('set_id', setId).order('position').order('id');
  fail(error);
  return (data ?? []).map(({ quiz_answer_keys, ...q }) => {
    const key = (Array.isArray(quiz_answer_keys) ? quiz_answer_keys[0] : quiz_answer_keys) as { correct_index: number; explanation: string | null; to_verify: boolean; confirmed: boolean } | null | undefined;
    return { ...(q as QuizQuestionRow), correct_index: key?.correct_index ?? 0, explanation: key?.explanation ?? null, to_verify: key?.to_verify ?? false, confirmed: key?.confirmed ?? false };
  });
}

export type AttemptWithScore = QuizAttemptRow & { score: number | null; total: number | null };
const withScore = ({ quiz_results, ...a }: QuizAttemptRow & { quiz_results: unknown }): AttemptWithScore => {
  const r = (Array.isArray(quiz_results) ? quiz_results[0] : quiz_results) as { score: number; total: number } | null | undefined;
  return { ...(a as QuizAttemptRow), score: r?.score ?? null, total: r?.total ?? null };
};

/** Tentatives d'UN jeu (parent), récentes d'abord. */
export async function fetchSetAttempts(setId: string): Promise<AttemptWithScore[]> {
  const { data, error } = await supabase.from('quiz_attempts').select('*, quiz_results(score, total)').eq('set_id', setId).order('started_at', { ascending: false });
  fail(error);
  return (data ?? []).map(withScore);
}

export type ChildAttempt = AttemptWithScore & { set_title: string };

/** Historique de UN enfant (parent) : toutes ses tentatives, avec le titre du jeu. */
export async function fetchChildAttempts(childId: string): Promise<ChildAttempt[]> {
  const { data, error } = await supabase.from('quiz_attempts').select('*, quiz_results(score, total), quiz_sets(title)').eq('child_id', childId).order('started_at', { ascending: false });
  fail(error);
  return (data ?? []).map((row) => ({ ...withScore(row), set_title: ((Array.isArray(row.quiz_sets) ? row.quiz_sets[0] : row.quiz_sets) as { title: string } | null)?.title ?? '' }));
}

/** Évaluations soumises, en attente de validation (toute la famille, parent). */
export async function fetchPendingQuizAttempts(): Promise<ChildAttempt[]> {
  const { data, error } = await supabase.from('quiz_attempts').select('*, quiz_results(score, total), quiz_sets(title)').eq('status', 'submitted').order('submitted_at');
  fail(error);
  return (data ?? []).map((row) => ({ ...withScore(row), set_title: ((Array.isArray(row.quiz_sets) ? row.quiz_sets[0] : row.quiz_sets) as { title: string } | null)?.title ?? '' }));
}

export type AttemptDetail = {
  attempt: AttemptWithScore;
  set: QuizSetRow | null;
  questions: (ParentQuestion & { choice_index: number | null; is_correct: boolean })[];
};

export async function fetchAttemptDetail(attemptId: string): Promise<AttemptDetail | null> {
  const { data: attempt, error } = await supabase.from('quiz_attempts').select('*, quiz_results(score, total)').eq('id', attemptId).maybeSingle();
  fail(error);
  if (!attempt) return null;
  const [questions, answers, set] = await Promise.all([
    fetchParentQuestions(attempt.set_id),
    supabase.from('quiz_answers').select('question_id, choice_index, is_correct').eq('attempt_id', attemptId),
    fetchQuizSet(attempt.set_id),
  ]);
  fail(answers.error);
  const byQuestion = new Map((answers.data ?? []).map((a) => [a.question_id, a]));
  return {
    attempt: withScore(attempt),
    set,
    questions: questions.map((q) => ({ ...q, choice_index: byQuestion.get(q.id)?.choice_index ?? null, is_correct: byQuestion.get(q.id)?.is_correct ?? false })),
  };
}

// ───────────── parent : écriture ─────────────
export type NewQuizSet = { id: string; familyId: string; childId: string; memberId: string; title: string; subject: string | null };

export async function createQuizSet(v: NewQuizSet): Promise<void> {
  const { error } = await supabase.from('quiz_sets').insert({ id: v.id, family_id: v.familyId, child_id: v.childId, title: v.title.trim(), subject: v.subject?.trim() || null, created_by: v.memberId });
  fail(error);
}
export async function updateQuizSet(id: string, patch: { title?: string; subject?: string | null }): Promise<void> {
  const { error } = await supabase.from('quiz_sets').update(patch).eq('id', id);
  fail(error);
}
export async function deleteQuizSet(id: string): Promise<void> {
  const { error } = await supabase.from('quiz_sets').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  fail(error);
}

export type QuestionInput = { id: string; setId: string; position: number; prompt: string; choices: string[]; correct: number; explanation: string | null };
export async function upsertQuestion(q: QuestionInput): Promise<void> {
  const { error } = await supabase.rpc('upsert_quiz_question', { p_id: q.id, p_set: q.setId, p_position: q.position, p_prompt: q.prompt, p_choices: q.choices, p_correct: q.correct, p_explanation: q.explanation ?? '' });
  fail(error);
}
export async function deleteQuestion(id: string): Promise<void> {
  const { error } = await supabase.rpc('delete_quiz_question', { p_id: id });
  fail(error);
}
export async function reorderQuestions(setId: string, ids: string[]): Promise<void> {
  const { error } = await supabase.rpc('reorder_quiz_questions', { p_set: setId, p_ids: ids });
  fail(error);
}
export async function setQuizStatus(setId: string, status: 'draft' | 'published'): Promise<void> {
  const { error } = await supabase.rpc('set_quiz_status', { p_set: setId, p_status: status });
  fail(error);
}
export async function copyQuizSet(source: string, newSet: string, childId: string): Promise<void> {
  const { error } = await supabase.rpc('copy_quiz_set', { p_source: source, p_new_set: newSet, p_child: childId });
  fail(error);
}
/** `showCorrection` : réglage posé par le parent AU MOMENT de valider (désactivé par défaut), stocké et appliqué côté serveur. */
/** Grille « Đáp án » : le parent confirme ses réponses (la réponse choisie devient la clé, confirmée, et le signalement « à vérifier » est levé). */
export async function confirmQuizAnswers(setId: string, answers: { question_id: string; correct: number }[]): Promise<void> {
  const { error } = await supabase.rpc('confirm_quiz_answers', { p_set: setId, p_answers: answers });
  fail(error);
}
/** Corrige le type de support enregistré sur le jeu (brouillon sans tentative) ; la règle de publication suit ce type. */
export async function setQuizMaterialKind(setId: string, kind: QuizMaterialKind): Promise<void> {
  const { error } = await supabase.rpc('set_quiz_material_kind', { p_set: setId, p_kind: kind });
  fail(error);
}
/** Les réglages posés par le parent AU MOMENT de valider (voir D-059). */
export async function validateQuizAttempt(attemptId: string, showCorrection = false): Promise<void> {
  const { error } = await supabase.rpc('validate_quiz_attempt', { p_attempt: attemptId, p_show_correction: showCorrection });
  fail(error);
}
export async function relaunchQuizEvaluation(setId: string, attemptId: string): Promise<void> {
  const { error } = await supabase.rpc('relaunch_quiz_evaluation', { p_set: setId, p_attempt: attemptId });
  fail(error);
}

// ───────────── enfant (RPC uniquement) ─────────────
export type ChildQuizSet = {
  set_id: string;
  title: string;
  subject: string | null;
  question_count: number;
  evaluation_attempt_id: string | null;
  evaluation_status: QuizAttemptStatus | null;
  can_start_evaluation: boolean;
};
export async function fetchChildQuizSets(): Promise<ChildQuizSet[]> {
  const { data, error } = await supabase.rpc('child_quiz_sets');
  fail(error);
  return (data ?? []) as ChildQuizSet[];
}

/** Positions et choix déjà mélangés par le serveur pour CETTE tentative ; ni bonne réponse ni explication. */
export type PlayQuestionRow = { question_id: string; position: number; prompt: string; choices: string[] };
export async function fetchChildQuestions(attemptId: string): Promise<PlayQuestionRow[]> {
  const { data, error } = await supabase.rpc('child_quiz_questions', { p_attempt: attemptId });
  fail(error);
  return (data ?? []) as PlayQuestionRow[];
}

export async function startQuizEvaluation(setId: string, attemptId: string): Promise<void> {
  const { error } = await supabase.rpc('start_quiz_evaluation', { p_set: setId, p_attempt: attemptId });
  fail(error);
}
export async function submitQuizEvaluation(attemptId: string, answers: { question_id: string; choice: number | null }[]): Promise<void> {
  const { error } = await supabase.rpc('submit_quiz_evaluation', { p_attempt: attemptId, p_answers: answers });
  fail(error);
}

/** Question ratée, telle que l'enfant la voit quand la correction est désactivée : énoncé + SA réponse, rien d'autre. */
export type MissedItem = { question_id: string; position: number; prompt: string; chosen_text: string | null };
/** Correction complète (réglage activé par le parent à la validation). Indices = positions affichées à l'enfant. */
export type CorrectionItem = {
  question_id: string;
  position: number;
  prompt: string;
  choices: string[];
  choice_index: number | null;
  correct_index: number;
  explanation: string | null;
  is_correct: boolean;
};
export type ChildQuizResult = {
  status: QuizAttemptStatus;
  set_id: string;
  /** Présents UNIQUEMENT une fois la tentative validée. */
  score?: number;
  total?: number;
  validated_at?: string;
  show_correction?: boolean;
  /** Correction désactivée : questions ratées seulement. */
  missed?: MissedItem[];
  /** Correction activée : toutes les questions avec bonne réponse et explication. */
  questions?: CorrectionItem[];
};
export async function fetchChildResult(attemptId: string): Promise<ChildQuizResult> {
  const { data, error } = await supabase.rpc('child_quiz_result', { p_attempt: attemptId });
  fail(error);
  return data as unknown as ChildQuizResult;
}

export type HistoryRow = { attempt_id: string; validated_at: string; score: number; total: number };
export async function fetchChildHistory(setId: string): Promise<HistoryRow[]> {
  const { data, error } = await supabase.rpc('child_quiz_history', { p_set: setId });
  fail(error);
  return (data ?? []) as HistoryRow[];
}

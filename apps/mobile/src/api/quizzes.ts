import type { QuizAttemptRow, QuizAttemptStatus, QuizMaterialKind, QuizQuestionRow, QuizSetRow } from '@/types/models';
import { fetchChildCatalog } from './catalog';
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

/** Titres des quiz du catalogue pour des tentatives (la table du catalogue n'est lisible par personne : RPC `parent_catalog_attempts`, par enfant). */
async function withCatalogTitles(rows: ChildAttempt[]): Promise<ChildAttempt[]> {
  const children = [...new Set(rows.filter((r) => r.catalog_id !== null).map((r) => r.child_id))];
  if (children.length === 0) return rows;
  const lists = await Promise.all(children.map((c) => supabase.rpc('parent_catalog_attempts', { p_child: c })));
  const titles = new Map<string, string>();
  for (const l of lists) {
    fail(l.error);
    for (const a of (l.data ?? []) as unknown as { attempt_id: string; title: string; week_label: string }[]) titles.set(a.attempt_id, `${a.week_label} — ${a.title}`);
  }
  return rows.map((r) => (r.catalog_id !== null ? { ...r, set_title: titles.get(r.id) ?? '' } : r));
}

/** Historique de UN enfant (parent) : toutes ses tentatives, avec le titre du jeu. */
export async function fetchChildAttempts(childId: string): Promise<ChildAttempt[]> {
  const { data, error } = await supabase.from('quiz_attempts').select('*, quiz_results(score, total), quiz_sets(title)').eq('child_id', childId).order('started_at', { ascending: false });
  fail(error);
  return withCatalogTitles((data ?? []).map((row) => ({ ...withScore(row), set_title: ((Array.isArray(row.quiz_sets) ? row.quiz_sets[0] : row.quiz_sets) as { title: string } | null)?.title ?? '' })));
}

/** Évaluations soumises, en attente de validation (toute la famille, parent). */
export async function fetchPendingQuizAttempts(): Promise<ChildAttempt[]> {
  const { data, error } = await supabase.from('quiz_attempts').select('*, quiz_results(score, total), quiz_sets(title)').eq('status', 'submitted').order('submitted_at');
  fail(error);
  return withCatalogTitles((data ?? []).map((row) => ({ ...withScore(row), set_title: ((Array.isArray(row.quiz_sets) ? row.quiz_sets[0] : row.quiz_sets) as { title: string } | null)?.title ?? '' })));
}

export type AttemptDetail = {
  attempt: AttemptWithScore;
  /** Jeu de la famille (null pour un quiz du catalogue : seul le titre est connu). */
  set: QuizSetRow | null;
  title: string;
  questions: (ParentQuestion & { choice_index: number | null; is_correct: boolean })[];
};

/** Revue d'une tentative SOUMISE ou validée de SON enfant (RPC `parent_attempt_review`) : marche pour un quiz du catalogue comme pour un jeu de famille. */
type ReviewRow = { question_id: string; position: number; number: number | null; needs_figure: boolean; prompt: string; choices: string[]; correct_index: number; explanation: string | null; choice_index: number | null; is_correct: boolean };

async function fetchCatalogAttemptDetail(attempt: QuizAttemptRow & { quiz_results: unknown }): Promise<AttemptDetail | null> {
  const { data, error } = await supabase.rpc('parent_attempt_review', { p_attempt: attempt.id });
  if (error) {
    if ((error as { message?: string }).message === 'not_submitted') return null;
    throw error;
  }
  const review = data as unknown as { title: string; questions: ReviewRow[] };
  return {
    attempt: withScore(attempt),
    set: null,
    title: review.title,
    questions: review.questions.map((q) => ({
      id: q.question_id, set_id: attempt.catalog_id ?? '', family_id: attempt.family_id, position: q.position, prompt: q.prompt, choices: q.choices, origin_number: q.number, needs_figure: q.needs_figure,
      created_at: attempt.created_at, updated_at: attempt.updated_at, correct_index: q.correct_index, explanation: q.explanation, to_verify: false, confirmed: true, choice_index: q.choice_index, is_correct: q.is_correct,
    })),
  };
}

export async function fetchAttemptDetail(attemptId: string): Promise<AttemptDetail | null> {
  const { data: attempt, error } = await supabase.from('quiz_attempts').select('*, quiz_results(score, total)').eq('id', attemptId).maybeSingle();
  fail(error);
  if (!attempt) return null;
  if (attempt.set_id === null) return fetchCatalogAttemptDetail(attempt);
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
    title: set?.title ?? '',
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
/** Date limite du quiz (D-079) : JOUR LOCAL `YYYY-MM-DD` (jamais un timestamp) ; `null` = sans date limite. Écrite par RPC seulement, jamais bloquante. */
export async function setQuizDueOn(setId: string, dueOn: string | null): Promise<void> {
  const { error } = await supabase.rpc('set_quiz_due_on', { p_set: setId, p_due: dueOn as string });
  fail(error);
}
/** Nombre de réponses déjà données par tentative EN COURS (parent) : jamais le détail des réponses. */
export type ProgressCount = { attempt_id: string; answered: number };
export async function fetchQuizProgressCounts(): Promise<ProgressCount[]> {
  const { data, error } = await supabase.rpc('quiz_progress_counts');
  fail(error);
  return (data ?? []) as ProgressCount[];
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
/** Support papier / « feuille de réponses seule » (D-062) : brouillon sans tentative ; jamais d'écriture directe. */
export async function setQuizPaperSupport(setId: string, paper: boolean, sheetOnly: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_quiz_paper_support', { p_set: setId, p_paper: paper, p_sheet_only: sheetOnly });
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
  /** D-080 : `catalog` = quiz du catalogue de l'administrateur (démarrage par `start_catalog_evaluation`) ; `family` = jeu importé par la famille. */
  source: 'family' | 'catalog';
  /** Quiz du catalogue : clé de la matière (libellé i18n) et semaine ; null pour un jeu de famille. */
  subject_key: string | null;
  week_label: string | null;
  title: string;
  subject: string | null;
  question_count: number;
  evaluation_attempt_id: string | null;
  evaluation_status: QuizAttemptStatus | null;
  can_start_evaluation: boolean;
  /** Support papier : écran « Phiếu trả lời ». « Feuille seule » : le serveur n'envoie que des lettres. */
  paper_support: boolean;
  answer_sheet_only: boolean;
  /** Date limite (jour local, `YYYY-MM-DD`) : information seulement, ne bloque jamais l'enfant. */
  due_on: string | null;
  /** Réponses déjà enregistrées de la tentative en cours. */
  answered_count: number;
};
export async function fetchChildQuizSets(): Promise<ChildQuizSet[]> {
  // pendant un déploiement, la fonction du catalogue peut ne pas encore exister : on n'ignore que CETTE erreur (jamais un refus ou un échec réseau)
  const missingFunction = (e: unknown) => ['PGRST202', '42883'].includes((e as { code?: string } | null)?.code ?? '');
  const [family, catalog] = await Promise.all([supabase.rpc('child_quiz_sets'), fetchChildCatalog().catch((e: unknown) => (missingFunction(e) ? [] : Promise.reject(e)))]);
  fail(family.error);
  const own = ((family.data ?? []) as unknown as Omit<ChildQuizSet, 'source' | 'subject_key' | 'week_label'>[]).map((s): ChildQuizSet => ({ ...s, source: 'family', subject_key: null, week_label: null }));
  const shared = catalog.map(
    (c): ChildQuizSet => ({
      set_id: c.quiz_id, source: 'catalog', subject_key: c.subject, week_label: c.week_label, title: c.title, subject: null, question_count: c.question_count,
      evaluation_attempt_id: c.evaluation_attempt_id, evaluation_status: c.evaluation_status, can_start_evaluation: c.can_start_evaluation, paper_support: c.paper_support,
      answer_sheet_only: c.answer_sheet_only, due_on: c.due_on, answered_count: c.answered_count,
    }),
  );
  return [...shared, ...own];
}

/**
 * Positions et choix déjà décidés par le serveur pour CETTE tentative (mélangés, ou dans l'ordre de la feuille pour un support papier) ; ni bonne réponse
 * ni explication ni drapeau « à vérifier ». `origin_number` : numéro de la feuille ; `needs_figure` : la question s'appuie sur une figure du papier.
 * « Feuille seule » : `prompt` vide et `choices` = lettres.
 */
export type PlayQuestionRow = { question_id: string; position: number; prompt: string; choices: string[]; origin_number: number | null; needs_figure: boolean };
export async function fetchChildQuestions(attemptId: string): Promise<PlayQuestionRow[]> {
  const { data, error } = await supabase.rpc('child_quiz_questions', { p_attempt: attemptId });
  fail(error);
  return (data ?? []) as PlayQuestionRow[];
}

/** Réponses déjà enregistrées de SA tentative en cours (positions AFFICHÉES) : reprise sur cet appareil ou un autre. Aucune information de correction. */
export type SavedAnswer = { question_id: string; choice: number };
export async function fetchChildProgress(attemptId: string): Promise<SavedAnswer[]> {
  const { data, error } = await supabase.rpc('child_quiz_progress', { p_attempt: attemptId });
  fail(error);
  return (data ?? []) as SavedAnswer[];
}
/** Enregistre (ou, avec `choice` null, efface) UNE réponse au fil de l'eau ; idempotent, refusé si la tentative est envoyée. */
export async function saveQuizProgress(attemptId: string, questionId: string, choice: number | null): Promise<void> {
  const { error } = await supabase.rpc('save_quiz_progress', { p_attempt: attemptId, p_question: questionId, p_choice: choice as number });
  fail(error);
}

/** `source` catalog (D-080) : quiz du catalogue ; absent = jeu de famille (les mutations déjà en file avant la mise à jour restent valides). */
export async function startQuizEvaluation(setId: string, attemptId: string, source: 'family' | 'catalog' = 'family'): Promise<void> {
  const { error } = source === 'catalog' ? await supabase.rpc('start_catalog_evaluation', { p_quiz: setId, p_attempt: attemptId }) : await supabase.rpc('start_quiz_evaluation', { p_set: setId, p_attempt: attemptId });
  fail(error);
}
export async function submitQuizEvaluation(attemptId: string, answers: { question_id: string; choice: number | null }[]): Promise<void> {
  const { error } = await supabase.rpc('submit_quiz_evaluation', { p_attempt: attemptId, p_answers: answers });
  fail(error);
}

/** Question ratée, telle que l'enfant la voit quand la correction est désactivée : énoncé + SA réponse, rien d'autre. */
export type MissedItem = { question_id: string; position: number; number: number | null; prompt: string; chosen_text: string | null };
/** Correction complète (réglage activé par le parent à la validation). Indices = positions affichées à l'enfant. */
export type CorrectionItem = {
  question_id: string;
  position: number;
  number: number | null;
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
  paper_support?: boolean;
  answer_sheet_only?: boolean;
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

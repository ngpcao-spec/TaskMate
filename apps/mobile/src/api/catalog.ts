import { parseImpact, parsePurgeResult, type PurgeImpact, type PurgeResult } from '@/domain/catalog-purge';
import type { QuizAttemptStatus, QuizMaterialKind, QuizStatus } from '@/types/models';
import { supabase } from './supabase';

/**
 * Catalogue de QCM (D-080). TOUT passe par des RPC : les tables du catalogue ne sont lisibles ni modifiables par aucun client (RLS sans politique).
 * L'administrateur de la plateforme est vérifié PAR LA BASE dans chaque RPC `catalog_*` ; ces fonctions ne décident de rien.
 */
const fail = (error: { message: string } | null): void => {
  if (error) throw error;
};

/** Le caller est-il administrateur ? (ne révèle que SON propre statut). Sert seulement à afficher l'entrée de menu : jamais une autorisation. */
export async function fetchIsPlatformAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_platform_admin');
  fail(error);
  return data === true;
}

// ───────────── administrateur ─────────────
export type AdminQuizRow = {
  id: string;
  country: string;
  grade: string;
  subject: string;
  week_label: string;
  title: string;
  status: QuizStatus;
  release_on: string | null;
  due_on: string | null;
  material_kind: QuizMaterialKind;
  question_count: number;
  to_verify_count: number;
  attempts_count: number;
};
export async function fetchCatalogList(): Promise<AdminQuizRow[]> {
  const { data, error } = await supabase.rpc('catalog_list', {});
  fail(error);
  return (data ?? []) as unknown as AdminQuizRow[];
}

export type AdminQuiz = {
  id: string;
  country: string;
  grade: string;
  subject: string;
  week_label: string;
  title: string;
  status: QuizStatus;
  release_on: string | null;
  due_on: string | null;
  material_kind: QuizMaterialKind;
  kind_detected: boolean;
  paper_support: boolean;
  answer_sheet_only: boolean;
  attempts_count: number;
};
export async function fetchCatalogQuiz(id: string): Promise<AdminQuiz | null> {
  const { data, error } = await supabase.rpc('catalog_get', { p_quiz: id });
  if (error) {
    if (error.code === 'P0002') return null;
    throw error;
  }
  return data as unknown as AdminQuiz;
}

/** Question vue par l'ADMIN : énoncé, source, clé (réponse, explication, « à vérifier », confirmée). */
export type AdminQuestion = {
  id: string;
  position: number;
  prompt: string;
  choices: string[];
  origin_number: number | null;
  needs_figure: boolean;
  source: string | null;
  correct_index: number;
  explanation: string | null;
  to_verify: boolean;
  confirmed: boolean;
};
export async function fetchCatalogQuestions(quizId: string): Promise<AdminQuestion[]> {
  const { data, error } = await supabase.rpc('catalog_questions_admin', { p_quiz: quizId });
  fail(error);
  return (data ?? []) as unknown as AdminQuestion[];
}

export type NewCatalogQuiz = { id: string; country: string; grade: string; subject: string; week: string; title: string };
export async function createCatalogQuiz(v: NewCatalogQuiz): Promise<void> {
  const { error } = await supabase.rpc('catalog_create_quiz', { p_quiz: v.id, p_country: v.country, p_grade: v.grade, p_subject: v.subject, p_week: v.week, p_title: v.title });
  fail(error);
}
/** Un QCM lu dans un fichier d'import : brouillon + dates écrits dans UNE transaction (`create_catalog_draft`), rejouable (id fixé), remplaçable seulement s'il est brouillon sans tentative. */
export type CatalogDraftInput = {
  id: string;
  country: string;
  grade: string;
  subject: string;
  week: string;
  title: string;
  questions: { prompt: string; choices: string[]; correct: number; explanation: string | null; source: string | null }[];
  releaseOn: string | null;
  dueOn: string | null;
  replace: boolean;
};
export async function createCatalogDraft(v: CatalogDraftInput): Promise<void> {
  const { error } = await supabase.rpc('create_catalog_draft', {
    p_quiz: v.id, p_country: v.country, p_grade: v.grade, p_subject: v.subject, p_week: v.week, p_title: v.title, p_questions: v.questions, p_kind: 'course', p_kind_detected: false,
    p_replace: v.replace, p_release: v.releaseOn ?? undefined, p_due: v.dueOn ?? undefined,
  });
  fail(error);
}

export type CatalogQuestionInput = { id: string; quizId: string; position: number; prompt: string; choices: string[]; correct: number; explanation: string | null; source: string | null };
export async function upsertCatalogQuestion(q: CatalogQuestionInput): Promise<void> {
  const { error } = await supabase.rpc('catalog_upsert_question', {
    p_id: q.id, p_quiz: q.quizId, p_position: q.position, p_prompt: q.prompt, p_choices: q.choices, p_correct: q.correct, p_explanation: q.explanation ?? '', p_source: q.source ?? '',
  });
  fail(error);
}
export async function deleteCatalogQuestion(id: string): Promise<void> {
  const { error } = await supabase.rpc('catalog_delete_question', { p_id: id });
  fail(error);
}
export async function reorderCatalogQuestions(quizId: string, ids: string[]): Promise<void> {
  const { error } = await supabase.rpc('catalog_reorder_questions', { p_quiz: quizId, p_ids: ids });
  fail(error);
}
/** L'admin confirme les réponses (grille « Đáp án ») : la réponse choisie devient la clé, confirmée, et « à vérifier » est levé. */
export async function confirmCatalogAnswers(quizId: string, answers: { question_id: string; correct: number }[]): Promise<void> {
  const { error } = await supabase.rpc('catalog_confirm_answers', { p_quiz: quizId, p_answers: answers });
  fail(error);
}
export async function updateCatalogInfo(quizId: string, week: string, title: string): Promise<void> {
  const { error } = await supabase.rpc('catalog_update_info', { p_quiz: quizId, p_week: week, p_title: title });
  fail(error);
}
export async function setCatalogKind(quizId: string, kind: QuizMaterialKind): Promise<void> {
  const { error } = await supabase.rpc('catalog_set_kind', { p_quiz: quizId, p_kind: kind });
  fail(error);
}
export async function setCatalogPaper(quizId: string, paper: boolean, sheetOnly: boolean): Promise<void> {
  const { error } = await supabase.rpc('catalog_set_paper', { p_quiz: quizId, p_paper: paper, p_sheet_only: sheetOnly });
  fail(error);
}
/** Mise à disposition et échéance : JOURS LOCAUX `YYYY-MM-DD` (jamais un timestamp). */
export async function setCatalogDates(quizId: string, releaseOn: string | null, dueOn: string | null): Promise<void> {
  const { error } = await supabase.rpc('catalog_set_dates', { p_quiz: quizId, p_release: releaseOn as string, p_due: dueOn as string });
  fail(error);
}
/** Publier / dépublier. Dépublier ne supprime aucune tentative. */
export async function setCatalogStatus(quizId: string, status: QuizStatus): Promise<void> {
  const { error } = await supabase.rpc('catalog_set_status', { p_quiz: quizId, p_status: status });
  fail(error);
}
export async function deleteCatalogQuiz(quizId: string): Promise<void> {
  const { error } = await supabase.rpc('catalog_delete_quiz', { p_quiz: quizId });
  fail(error);
}

/** Impact d'une suppression définitive (D-091) : familles, enfants, tentatives par état, points déjà attribués. Administrateur seulement (revérifié par la base). */
export async function fetchCatalogQuizImpact(quizId: string): Promise<PurgeImpact> {
  const { data, error } = await supabase.rpc('catalog_quiz_impact', { p_quiz: quizId });
  fail(error);
  return parseImpact(data);
}
/**
 * Suppression DÉFINITIVE (D-091), même publiée et commencée. `confirm` = le titre exact : la BASE le compare (`confirm_mismatch` sinon). Les points déjà
 * gagnés sont conservés. Rejouable : un QCM déjà supprimé répond `purged: false`.
 */
export async function purgeCatalogQuiz(quizId: string, confirm: string): Promise<PurgeResult> {
  const { data, error } = await supabase.rpc('catalog_purge_quiz', { p_quiz: quizId, p_confirm: confirm });
  fail(error);
  return parsePurgeResult(data);
}

// ───────────── parent : classe, matières, décalage ─────────────
export async function setChildClass(childId: string, country: string, grade: string): Promise<void> {
  const { error } = await supabase.rpc('set_child_class', { p_child: childId, p_country: country, p_grade: grade });
  fail(error);
}
export async function setChildSubject(childId: string, subject: string, active: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_child_subject', { p_child: childId, p_subject: subject, p_active: active });
  fail(error);
}
/** Décale d'UNE semaine (−1 ou +1) la matière d'UN enfant (borné à ±4 par le serveur). */
export async function shiftChildSubject(childId: string, subject: string, delta: -1 | 1): Promise<void> {
  const { error } = await supabase.rpc('shift_child_subject', { p_child: childId, p_subject: subject, p_delta: delta });
  fail(error);
}
export type ChildSubject = { subject: string; week_offset: number };
export async function fetchChildSubjects(childId: string): Promise<ChildSubject[]> {
  const { data, error } = await supabase.rpc('parent_child_subjects', { p_child: childId });
  fail(error);
  return (data ?? []) as ChildSubject[];
}

/** Quiz du catalogue de SON enfant (parent) : dates décalées, disponibilité, dernière tentative. Jamais les réponses (voir `parent_attempt_review`). */
export type ParentCatalogRow = {
  quiz_id: string;
  subject: string;
  week_label: string;
  title: string;
  question_count: number;
  release_on: string;
  due_on: string;
  available: boolean;
  attempt_id: string | null;
  attempt_status: QuizAttemptStatus | null;
  answered_count: number;
  score: number | null;
  total: number | null;
  max_points: number;
  points_awarded: number;
};
export async function fetchParentCatalog(childId: string): Promise<ParentCatalogRow[]> {
  const { data, error } = await supabase.rpc('parent_catalog_overview', { p_child: childId });
  fail(error);
  return (data ?? []) as unknown as ParentCatalogRow[];
}
/**
 * Détail d'un quiz du catalogue pour le PARENT (D-089) : questions, bonnes réponses, explications et réponses de l'enfant, choix dans l'ORDRE D'ORIGINE
 * (la réponse de l'enfant est déjà convertie en indice d'origine par le serveur). Le serveur refuse (`forbidden`) tout quiz qui n'est pas attribuable à cet enfant.
 */
export type ParentQuizQuestion = {
  question_id: string;
  position: number;
  number: number | null;
  needs_figure: boolean;
  prompt: string;
  choices: string[];
  correct_index: number;
  explanation: string | null;
  to_verify: boolean;
  confirmed: boolean;
  /** Indice d'ORIGINE de la réponse de l'enfant (null = pas de réponse). */
  choice_index: number | null;
  /** Justesse calculée par le serveur à l'envoi (null tant que la tentative est en cours ou absente). */
  is_correct: boolean | null;
};
export type ParentQuizDetail = {
  quiz: { id: string; subject: string; week_label: string; title: string; release_on: string; due_on: string; material_kind: QuizMaterialKind; paper_support: boolean; answer_sheet_only: boolean; question_count: number; max_points: number };
  attempt: { id: string; status: QuizAttemptStatus; answered: number; started_at: string; submitted_at: string | null; validated_at: string | null; show_correction: boolean; score: number | null; total: number | null; points_awarded: number | null } | null;
  questions: ParentQuizQuestion[];
};
export async function fetchParentQuizDetail(childId: string, quizId: string): Promise<ParentQuizDetail> {
  const { data, error } = await supabase.rpc('parent_quiz_detail', { p_child: childId, p_catalog: quizId });
  fail(error);
  return data as unknown as ParentQuizDetail;
}
/**
 * Quiz publiés pour l'enfant mais PAS ENCORE OUVERTS (D-086) : MÉTADONNÉES seulement (matière, semaine, titre, ouverture et échéance effectives,
 * maximum du barème), jamais une question ni une réponse. Enfant : `childId` null (le serveur déduit SON identité, une semaine d'avance au plus) ;
 * parent : l'enfant de SA famille.
 */
export type UpcomingCatalogRow = { quiz_id: string; subject: string; week_label: string; title: string; release_on: string; due_on: string; max_points: number };
export async function fetchCatalogUpcoming(childId: string | null): Promise<UpcomingCatalogRow[]> {
  const { data, error } = await supabase.rpc('catalog_upcoming_for_child', childId === null ? {} : { p_child: childId });
  fail(error);
  return (data ?? []) as unknown as UpcomingCatalogRow[];
}
export async function relaunchCatalogEvaluation(quizId: string, childId: string, attemptId: string): Promise<void> {
  const { error } = await supabase.rpc('relaunch_catalog_evaluation', { p_quiz: quizId, p_child: childId, p_attempt: attemptId });
  fail(error);
}

// ───────────── enfant ─────────────
export type ChildCatalogRow = {
  quiz_id: string;
  subject: string;
  week_label: string;
  title: string;
  question_count: number;
  evaluation_attempt_id: string | null;
  evaluation_status: QuizAttemptStatus | null;
  can_start_evaluation: boolean;
  paper_support: boolean;
  answer_sheet_only: boolean;
  due_on: string | null;
  answered_count: number;
  /** Jour d'ouverture (jour local, déjà décalé par le parent). */
  release_on: string;
  /** Résultat : renseigné par le serveur SEULEMENT une fois la tentative validée par le parent (null avant). */
  score: number | null;
  total: number | null;
  /** D-084 : maximum du barème (même fonction SQL que le crédit) et points déjà rapportés par ce quiz (0 si rien). */
  max_points: number;
  points_awarded: number;
};
export async function fetchChildCatalog(): Promise<ChildCatalogRow[]> {
  const { data, error } = await supabase.rpc('child_catalog_quizzes');
  fail(error);
  return (data ?? []) as unknown as ChildCatalogRow[];
}
export async function startCatalogEvaluation(quizId: string, attemptId: string): Promise<void> {
  const { error } = await supabase.rpc('start_catalog_evaluation', { p_quiz: quizId, p_attempt: attemptId });
  fail(error);
}

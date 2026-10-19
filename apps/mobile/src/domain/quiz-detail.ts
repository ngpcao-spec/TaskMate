import type { QuizAttemptStatus, QuizMaterialKind } from '@/types/models';

/**
 * Détail d'un quiz pour le PARENT (D-089) : calculs purs de l'affichage. Le serveur (`parent_quiz_detail`) fournit les choix dans l'ORDRE D'ORIGINE et la
 * réponse de l'enfant déjà convertie en indice d'ORIGINE ; ici on ne fait que la marquer, jamais la convertir.
 */

export type DetailState = 'todo' | 'in_progress' | 'waiting' | 'validated';

export const detailState = (status: QuizAttemptStatus | null | undefined): DetailState =>
  status === 'validated' ? 'validated' : status === 'submitted' ? 'waiting' : status === 'in_progress' ? 'in_progress' : 'todo';

type FlaggedQuestion = { to_verify: boolean; confirmed: boolean };

/**
 * Petit badge « cần kiểm tra » (parent seulement) : une réponse signalée « à vérifier » non confirmée, ou — pour un examen — une réponse jamais confirmée.
 * Un cours ou une liste dont la clé n'est pas signalée n'a pas à être « confirmé ».
 */
export const needsCheck = (q: FlaggedQuestion, kind: QuizMaterialKind): boolean => !q.confirmed && (q.to_verify || kind === 'exam' || kind === 'exam_key');

export type ChoiceMark = { index: number; letter: string; text: string; correct: boolean; chosen: boolean; wrong: boolean };

/**
 * Marque chaque choix : bonne réponse, choix de l'enfant, choix de l'enfant FAUX. La comparaison se fait sur des indices d'ORIGINE des deux côtés
 * (clé et réponse), jamais sur la position affichée à l'enfant. `showChild` faux (quiz pas commencé) : aucune marque de réponse d'enfant.
 */
export function choiceMarks(q: { choices: readonly string[]; correct_index: number; choice_index: number | null }, showChild: boolean): ChoiceMark[] {
  return q.choices.map((text, index) => {
    const chosen = showChild && q.choice_index === index;
    const correct = q.correct_index === index;
    return { index, letter: String.fromCharCode(65 + index), text, correct, chosen, wrong: chosen && !correct };
  });
}

/** Numéro affiché d'une question : le numéro d'origine du document, sinon l'ordre (1-based). */
export const questionNumber = (q: { number: number | null; position: number }): number => q.number ?? q.position + 1;

export type DetailSummary = { state: DetailState; answered: number; total: number; score: number | null; scoreTotal: number | null; points: number | null };

/** Résumé du haut d'écran : « đã trả lời N/total » en cours ; score X/Y et « +N điểm » une fois validé (la tentative envoyée affiche déjà son score). */
export function detailSummary(attempt: { status: QuizAttemptStatus; answered: number; score: number | null; total: number | null; points_awarded: number | null } | null, questionCount: number): DetailSummary {
  const state = detailState(attempt?.status);
  const done = state === 'waiting' || state === 'validated';
  return {
    state,
    answered: attempt?.answered ?? 0,
    total: questionCount,
    score: done && attempt?.score != null ? attempt.score : null,
    scoreTotal: done && attempt?.total != null ? attempt.total : null,
    points: state === 'validated' ? (attempt?.points_awarded ?? 0) : null,
  };
}

/** Le serveur refuse (`forbidden`, 42501) un quiz qui n'est pas attribuable à l'enfant ou un appelant qui n'est pas parent de sa famille. */
export const isForbidden = (error: unknown): boolean => {
  const e = error as { code?: string; message?: string } | null;
  return e?.code === '42501' || e?.message === 'forbidden';
};

/**
 * Suppression définitive d'un QCM du catalogue (D-091). Calculs purs ; l'autorité reste la base (`catalog_purge_quiz` revérifie l'administrateur ET le titre exact).
 * Les points déjà gagnés sont CONSERVÉS par la purge : l'écran le dit en clair.
 */

/** Impact lu par `catalog_quiz_impact` (compteurs de ce QCM, jamais ceux d'un autre). */
export type PurgeImpact = {
  quiz_id: string;
  title: string;
  subject: string;
  country: string;
  grade: string;
  week_label: string;
  status: string;
  families: number;
  children: number;
  attempts: number;
  in_progress: number;
  submitted: number;
  validated: number;
  points: number;
  questions: number;
  answers: number;
};

/** Résultat de `catalog_purge_quiz` : `purged: false` = déjà supprimé (rejeu), sans compteur. */
export type PurgeResult = { purged: boolean; title: string; counts: Pick<PurgeImpact, 'families' | 'children' | 'attempts' | 'validated' | 'points' | 'questions'> };

const count = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.trunc(v) : 0);
const text = (v: unknown): string => (typeof v === 'string' ? v : '');

export function parseImpact(raw: unknown): PurgeImpact {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    quiz_id: text(r.quiz_id), title: text(r.title), subject: text(r.subject), country: text(r.country), grade: text(r.grade), week_label: text(r.week_label), status: text(r.status),
    families: count(r.families), children: count(r.children), attempts: count(r.attempts), in_progress: count(r.in_progress), submitted: count(r.submitted),
    validated: count(r.validated), points: count(r.points), questions: count(r.questions), answers: count(r.answers),
  };
}

export function parsePurgeResult(raw: unknown): PurgeResult {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const impact = parseImpact(r);
  return {
    purged: r.purged === true,
    title: text(r.title),
    counts: { families: impact.families, children: impact.children, attempts: impact.attempts, validated: impact.validated, points: impact.points, questions: impact.questions },
  };
}

/**
 * Le bouton rouge n'est actif que si le titre retapé est EXACTEMENT celui du QCM (casse et accents compris) ; seuls les espaces autour de la saisie sont tolérés
 * (le titre est enregistré sans espace autour). Un titre vide ne correspond jamais.
 */
export function purgeConfirmed(typed: string, title: string): boolean {
  return title.length > 0 && typed.trim() === title;
}

/** Ce que le serveur reçoit comme confirmation (jamais plus que ce qui a été comparé). */
export const purgeConfirmText = (typed: string): string => typed.trim();

/** Le QCM n'a jamais été commencé : la purge ne supprime que lui. */
export const hasNoAttempts = (i: Pick<PurgeImpact, 'attempts'>): boolean => i.attempts === 0;

/** Un QCM purgé (ou jamais existé) : les RPC répondent « introuvable » ; l'écran affiche « plus disponible » au lieu de planter. */
export function isGoneCode(code: string): boolean {
  return code === 'attempt_not_found' || code === 'set_not_found';
}

/** Erreur d'une RPC (message = code serveur) : le quiz ou la tentative n'existe plus. */
export function isGoneError(error: unknown): boolean {
  const message = typeof error === 'object' && error !== null && 'message' in error ? String((error as { message: unknown }).message) : '';
  return isGoneCode(message);
}

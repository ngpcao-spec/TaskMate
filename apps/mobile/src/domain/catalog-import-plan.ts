import type { ParsedQuiz } from '@/domain/catalog-import';

/**
 * Plan d'écriture d'un import d'administration (D-081) : quels QCM créer, lesquels remplacent un brouillon, lesquels sont ignorés. Fonctions pures.
 * Une case déjà occupée n'est JAMAIS écrasée en silence : par défaut elle est ignorée ; « Remplacer » n'est proposé que pour un brouillon SANS tentative
 * (la base le refuse sinon : `set_published`, `set_has_attempts`).
 */
export type ExistingQuiz = { id: string; country: string; grade: string; subject: string; week_label: string; status: 'draft' | 'published'; attempts_count: number; title: string };

/** Même clé de case que l'index unique de la base : semaine sans casse ni espaces superflus. */
export const slotKey = (country: string, grade: string, subject: string, week: string): string => [country, grade, subject, week.trim().replace(/\s+/g, ' ').toLowerCase()].join('|');

export type ConflictKind = 'replaceable' | 'published' | 'attempts';
export type PlanItem = {
  quiz: ParsedQuiz;
  /** Identifiant fixé à la création du plan : un rejeu ne crée jamais de doublon. */
  id: string;
  /** Case occupée : le QCM existant et ce qu'on peut en faire. */
  conflict: { existing: ExistingQuiz; kind: ConflictKind } | null;
};
export type Decision = 'replace' | 'skip';
export type Decisions = Readonly<Record<number, Decision>>;

export function planImport(quizzes: readonly ParsedQuiz[], existing: readonly ExistingQuiz[], newId: () => string): PlanItem[] {
  const bySlot = new Map(existing.map((e) => [slotKey(e.country, e.grade, e.subject, e.week_label), e]));
  return quizzes.map((quiz) => {
    const found = bySlot.get(slotKey(quiz.country, quiz.grade, quiz.subject, quiz.week));
    if (!found) return { quiz, id: newId(), conflict: null };
    const kind: ConflictKind = found.status !== 'draft' ? 'published' : found.attempts_count > 0 ? 'attempts' : 'replaceable';
    return { quiz, id: found.id, conflict: { existing: found, kind } };
  });
}

/** Décision effective d'un QCM : sans conflit → écrire ; avec conflit → « remplacer » seulement si c'est possible ET choisi, sinon ignorer (jamais d'écrasement silencieux). */
export function effectiveDecision(item: PlanItem, decisions: Decisions): 'create' | 'replace' | 'skip' {
  if (!item.conflict) return 'create';
  return item.conflict.kind === 'replaceable' && decisions[item.quiz.block] === 'replace' ? 'replace' : 'skip';
}

export type WriteStep = { item: PlanItem; replace: boolean };
export const writeSteps = (plan: readonly PlanItem[], decisions: Decisions): WriteStep[] =>
  plan.flatMap((item) => {
    const d = effectiveDecision(item, decisions);
    return d === 'skip' ? [] : [{ item, replace: d === 'replace' }];
  });

export type StepResult = { block: number; id: string; outcome: 'created' | 'replaced' | 'skipped' | 'failed'; error?: string };
export type PublishResult = { block: number; id: string; outcome: 'published' | 'draft'; error?: string };

export const summarize = (results: readonly StepResult[]) => ({
  created: results.filter((r) => r.outcome === 'created').length,
  replaced: results.filter((r) => r.outcome === 'replaced').length,
  skipped: results.filter((r) => r.outcome === 'skipped').length,
  failed: results.filter((r) => r.outcome === 'failed').length,
});

/** Ce qu'« Enregistrer en brouillons » puis « Publier tout » peut encore faire : les QCM écrits (créés ou remplacés) et pas encore publiés. */
export const publishable = (results: readonly StepResult[], published: readonly PublishResult[]): StepResult[] => {
  const done = new Set(published.filter((p) => p.outcome === 'published').map((p) => p.block));
  return results.filter((r) => (r.outcome === 'created' || r.outcome === 'replaced') && !done.has(r.block));
};

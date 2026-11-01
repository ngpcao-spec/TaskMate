import type { PandaStage } from './panda';
import { ENERGY_QUIZ_VALIDATED, ENERGY_TASK_CHECKED } from './panda';

/**
 * Voix du panda (D-104) : toutes les répliques sont écrites à l'avance (aucune IA) dans les fichiers i18n, `panda.lines.<situation>.s<stade>.v<n>`.
 * Le panda ne parle JAMAIS d'un frère ou d'une sœur, ne donne JAMAIS une réponse de quiz et ne pousse JAMAIS à acheter.
 */
export type PandaSituation =
  | 'greeting_morning'
  | 'greeting_afternoon'
  | 'greeting_evening'
  | 'task_checked'
  | 'all_done'
  | 'quiz_validated'
  | 'nothing_yet_evening';

/** Nombre de variantes écrites par situation (2 à 3). */
export const LINE_VARIANTS: Record<PandaSituation, number> = {
  greeting_morning: 2,
  greeting_afternoon: 2,
  greeting_evening: 2,
  task_checked: 3,
  all_done: 3,
  quiz_validated: 3,
  nothing_yet_evening: 2,
};
export const PANDA_SITUATIONS = Object.keys(LINE_VARIANTS) as PandaSituation[];

/** Clé i18n de la variante `variant` (0-based, ramenée dans l'intervalle) de la situation pour le stade. */
export function pandaLineKey(stage: PandaStage, situation: PandaSituation, variant: number): string {
  const n = LINE_VARIANTS[situation];
  const v = ((Math.trunc(variant) % n) + n) % n;
  return `panda.lines.${situation}.s${stage}.v${v + 1}`;
}

/** Toutes les clés d'une situation et d'un stade (pour les tests et la vérification des textes). */
export const pandaLineKeys = (stage: PandaStage, situation: PandaSituation): string[] =>
  Array.from({ length: LINE_VARIANTS[situation] }, (_, i) => pandaLineKey(stage, situation, i));

/** Valeurs d'interpolation communes à toutes les répliques. */
export const pandaLineParams = (name: string): { name: string; energy: number; quizEnergy: number } => ({
  name,
  energy: ENERGY_TASK_CHECKED,
  quizEnergy: ENERGY_QUIZ_VALIDATED,
});

/** Salutation selon l'heure locale de la famille (matin < 12 h, après-midi < 18 h, soir ensuite). */
export function greetingFor(localHour: number): Extract<PandaSituation, 'greeting_morning' | 'greeting_afternoon' | 'greeting_evening'> {
  return localHour < 12 ? 'greeting_morning' : localHour < 18 ? 'greeting_afternoon' : 'greeting_evening';
}

export type PandaLineContext = {
  stage: PandaStage;
  done: number;
  total: number;
  localHour: number;
  /** Une réaction vient d'avoir lieu : « checked » (tâche cochée), « quiz » (quiz validé) ; sinon rien. */
  event?: 'checked' | 'quiz' | null;
  /** Graine stable (nombre de tâches faites, jour…) pour changer de variante sans hasard. */
  seed?: number;
};

/** Situation à exprimer : l'événement en cours d'abord, sinon l'état du jour. */
export function pandaSituation(ctx: Omit<PandaLineContext, 'stage'>): PandaSituation {
  if (ctx.event === 'quiz') return 'quiz_validated';
  if (ctx.event === 'checked') return ctx.total > 0 && ctx.done >= ctx.total ? 'all_done' : 'task_checked';
  if (ctx.total > 0 && ctx.done >= ctx.total) return 'all_done';
  if (ctx.done === 0 && ctx.localHour >= 20) return 'nothing_yet_evening';
  return greetingFor(ctx.localHour);
}

/** Clé de la réplique à afficher pour ce contexte. */
export function pickPandaLine(ctx: PandaLineContext): { situation: PandaSituation; key: string } {
  const situation = pandaSituation(ctx);
  return { situation, key: pandaLineKey(ctx.stage, situation, ctx.seed ?? 0) };
}

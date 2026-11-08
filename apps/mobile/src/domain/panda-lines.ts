import type { PandaStage } from './panda';

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
  | 'nothing_yet_evening'
  // D-105 : aventures (prête, en voyage, rentrée, doublon) et une ligne de récit par destination
  | 'adventure_ready'
  | 'adventure_away'
  | 'adventure_back'
  | 'adventure_duplicate'
  // D-107 : le grand départ (départ, mot sur la porte, retour avec le paquet) et une invitation par destination
  | 'adventure_leave'
  | 'adventure_note'
  | 'adventure_home_gift'
  | InviteSituation
  | StorySituation;

/** Destinations du catalogue des aventures (D-105) : leur slug donne la clé de récit (`story_ha_long`…). */
export const STORY_DESTINATIONS = ['ha-long', 'hoi-an', 'mekong', 'da-lat', 'sa-pa', 'phong-nha'] as const;
type DestinationKey = 'ha_long' | 'hoi_an' | 'mekong' | 'da_lat' | 'sa_pa' | 'phong_nha';
export type StorySituation = `story_${DestinationKey}`;
/** D-107 : invitation au voyage (feuille « carte postale »), une par destination. */
export type InviteSituation = `adventure_invite_${DestinationKey}`;

/** Nombre de variantes écrites par situation (2 à 3). */
export const LINE_VARIANTS: Record<PandaSituation, number> = {
  greeting_morning: 2,
  greeting_afternoon: 2,
  greeting_evening: 2,
  task_checked: 3,
  all_done: 3,
  quiz_validated: 3,
  nothing_yet_evening: 2,
  adventure_ready: 2,
  adventure_away: 2,
  adventure_back: 2,
  adventure_duplicate: 2,
  adventure_leave: 2,
  adventure_note: 2,
  adventure_home_gift: 2,
  adventure_invite_ha_long: 2,
  adventure_invite_hoi_an: 2,
  adventure_invite_mekong: 2,
  adventure_invite_da_lat: 2,
  adventure_invite_sa_pa: 2,
  adventure_invite_phong_nha: 2,
  story_ha_long: 2,
  story_hoi_an: 2,
  story_mekong: 2,
  story_da_lat: 2,
  story_sa_pa: 2,
  story_phong_nha: 2,
};

/** Situation de récit d'une destination (slug du catalogue) ; `null` pour une destination sans récit écrit. */
export function storySituation(destination: string): StorySituation | null {
  const key = `story_${destination.replace(/-/g, '_')}`;
  return key in LINE_VARIANTS ? (key as StorySituation) : null;
}
/** D-107 : situation d'invitation d'une destination (slug du catalogue) ; `null` pour une destination sans invitation écrite. */
export function inviteSituation(destination: string): InviteSituation | null {
  const key = `adventure_invite_${destination.replace(/-/g, '_')}`;
  return key in LINE_VARIANTS ? (key as InviteSituation) : null;
}
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

/**
 * Valeurs d'interpolation communes à toutes les répliques. D-106 : l'énergie affichée est celle que le serveur donne (les points de la tâche cochée,
 * les points attribués au quiz) — jamais une constante du client.
 */
export const pandaLineParams = (
  name: string,
  destination = '',
  amounts: { energy?: number; quizEnergy?: number } = {},
): { name: string; energy: number; quizEnergy: number; destination: string } => ({
  name,
  energy: Math.max(0, Math.floor(amounts.energy ?? 0)),
  quizEnergy: Math.max(0, Math.floor(amounts.quizEnergy ?? 0)),
  destination,
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

import type { PandaMood } from './panda';

/** Promenade du panda dans Hôm nay (D-106) : il marche d'un bord à l'autre de son panneau, se retourne, et revient. Calculs purs. */

/** Vitesse de marche (pt/s) : calme, pour un enfant (≈ 7 s pour traverser un téléphone). */
export const WALK_SPEED = 30;
/** Pause à chaque bord avant de se retourner (ms). */
export const WALK_PAUSE_MS = 900;
/** Course minimale (pt) en dessous de laquelle le panda reste au centre (panneau trop étroit). */
export const WALK_MIN_RANGE = 24;

/** Le panda se promène sauf s'il dort, s'il est en voyage (carte postale) ou si « réduire les animations » est activé. */
export const pandaWalks = (o: { mood: PandaMood; travelling: boolean; reduceMotion: boolean }): boolean => !o.reduceMotion && !o.travelling && o.mood !== 'dort';

export type WalkPlan = {
  /** Déplacement horizontal maximal (pt) depuis le bord gauche. */
  range: number;
  /** Position de départ (centre du panneau). */
  start: number;
  /** Durée d'une traversée complète (ms). */
  crossMs: number;
  /** Durée du premier trajet, du centre au bord droit (ms). */
  firstLegMs: number;
};

/** Plan de marche pour un panneau de `laneWidth` pt et un panda de `size` pt ; `null` si le panneau est trop étroit pour marcher. */
export function walkPlan(laneWidth: number, size: number): WalkPlan | null {
  const range = Math.floor(laneWidth - size);
  if (!Number.isFinite(range) || range < WALK_MIN_RANGE) return null;
  const ms = (distance: number) => Math.round((distance / WALK_SPEED) * 1000);
  return { range, start: Math.round(range / 2), crossMs: ms(range), firstLegMs: ms(range - Math.round(range / 2)) };
}

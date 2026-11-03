/**
 * Animations du panda vidéo de Hôm nay enfant (V2, D-106) : machine d'états PURE, un seul gestionnaire pour toutes les réactions.
 *
 * États affichés : `idle` (vidéo de repos du stade, en boucle), `happy` (coche), `curious` (toucher), `sleep` (fin de journée).
 * - `happy`, `curious`, `sleep` : UNE lecture ; la fin vient de l'événement réel `ended` de la vidéo (jamais d'un minuteur).
 *   Après `happy` / `curious` : retour à `idle`. Après `sleep` : image du panda endormi (`asleep`), aucun retour automatique.
 * - Priorités `sleep` > `happy` > `curious` > `idle`. `curious` n'interrompt jamais `happy` (un toucher pendant `happy` est ignoré) ;
 *   `happy` interrompt `curious` ; `sleep` passe devant tout mais n'interrompt pas un `happy` commencé : il attend sa fin.
 * - AUCUNE file : au plus UNE animation en attente, remplacée seulement par une plus prioritaire, abandonnée si elle n'a pas pu démarrer
 *   dans les `PENDING_MAX_MS` (3 s). (La fin de journée n'a pas besoin d'attendre : l'écran redemande `sleep` tant que la journée est finie.)
 * - `curious` : au moins `CURIOUS_GAP_MS` (1 s) après la fin du précédent.
 * - Une animation non prête à temps (`failed`) : retour au repos (ou, pour `sleep`, directement l'image endormie : jamais d'écran noir).
 */
export type PandaAnim = 'idle' | 'happy' | 'curious' | 'sleep';
export type PandaReaction = Exclude<PandaAnim, 'idle'>;

export const PENDING_MAX_MS = 3000;
export const CURIOUS_GAP_MS = 1000;
/** Au-delà, une réaction dont la vidéo n'est pas prête est abandonnée (le panda reste au repos). */
export const READY_TIMEOUT_MS = 1500;
/** Fondu croisé entre deux vidéos. */
export const CROSSFADE_MS = 150;

const PRIORITY: Record<PandaAnim, number> = { idle: 0, curious: 1, happy: 2, sleep: 3 };

export type PandaAnimState = {
  /** animation demandée à l'affichage (en préparation ou en lecture) */
  current: PandaAnim;
  /** fin de `sleep` atteinte : image du panda endormi, plus rien ne joue */
  asleep: boolean;
  pending: { anim: PandaReaction; at: number } | null;
  /** fin du dernier `curious` (ms), pour le délai minimal */
  lastCuriousEnd: number | null;
  /** incrémenté à chaque démarrage : relance la même vidéo (ex. deux `happy` séparés par un repos) */
  serial: number;
};

export const initialPandaAnim: PandaAnimState = { current: 'idle', asleep: false, pending: null, lastCuriousEnd: null, serial: 0 };

const start = (s: PandaAnimState, anim: PandaAnim): PandaAnimState => ({ ...s, current: anim, asleep: false, pending: null, serial: s.serial + 1 });

/**
 * Demande d'une réaction. `available` : réactions qui ont une vidéo pour ce stade (stades sans vidéo : aucun effet visible, état inchangé).
 */
export function requestAnim(s: PandaAnimState, anim: PandaReaction, now: number, available: ReadonlySet<PandaReaction>): PandaAnimState {
  if (!available.has(anim)) return s;
  // endormi : plus de réaction (le panda dort ; il se réveille quand la journée n'est plus finie, `wake`)
  if (s.asleep) return s;
  if (anim === 'curious' && s.lastCuriousEnd !== null && now - s.lastCuriousEnd < CURIOUS_GAP_MS) return s;
  if (s.current === 'idle') return start(s, anim);
  if (s.current === anim) return s; // déjà en cours : jamais deux fois la même d'affilée
  if (s.current === 'sleep') return s; // le coucher passe devant tout
  // `sleep` n'interrompt pas un `happy` commencé : il attend sa fin
  if (anim === 'sleep' && s.current === 'happy') return withPending(s, anim, now);
  if (PRIORITY[anim] > PRIORITY[s.current]) return start(s, anim);
  // moins prioritaire (ex. toucher pendant `happy`) : ignoré, jamais mis en attente
  return s;
}

function withPending(s: PandaAnimState, anim: PandaReaction, now: number): PandaAnimState {
  if (s.pending && PRIORITY[s.pending.anim] > PRIORITY[anim]) return s;
  return { ...s, pending: { anim, at: now } };
}

/** Fin réelle (`ended`) de l'animation `anim` ; ignorée si ce n'est plus l'animation courante. */
export function animEnded(s: PandaAnimState, anim: PandaAnim, now: number): PandaAnimState {
  if (anim === 'idle' || s.current !== anim) return s;
  if (anim === 'sleep') return { ...s, asleep: true, pending: null };
  const after: PandaAnimState = { ...s, current: 'idle', lastCuriousEnd: anim === 'curious' ? now : s.lastCuriousEnd };
  const p = s.pending;
  if (p && now - p.at <= PENDING_MAX_MS) return start({ ...after, pending: null }, p.anim);
  return { ...after, pending: null };
}

/** La vidéo de `anim` n'a pas pu démarrer (pas prête à temps, lecture refusée, fichier absent). */
export function animFailed(s: PandaAnimState, anim: PandaAnim, now: number): PandaAnimState {
  if (anim === 'idle' || s.current !== anim) return s;
  if (anim === 'sleep') return { ...s, asleep: true, pending: null }; // image endormie directement
  return animEnded(s, anim, now);
}

/** Journée déjà finie et coucher déjà joué aujourd'hui : image endormie directement, sans rejouer la vidéo. */
export function restAsleep(s: PandaAnimState): PandaAnimState {
  if (s.asleep) return s;
  return { ...s, current: 'sleep', asleep: true, pending: null };
}

/** La journée n'est plus finie (tâche décochée) ou un nouveau jour commence : retour au repos. */
export function wake(s: PandaAnimState): PandaAnimState {
  if (s.current !== 'sleep' && !s.asleep && s.pending?.anim !== 'sleep') return s;
  return { ...s, current: 'idle', asleep: false, pending: null };
}

/** Coucher du jour : `play` (à jouer), `still` (déjà joué aujourd'hui : image endormie), `none` (journée pas finie). */
export function sleepPlan(dayDone: boolean, playedOn: string | null, today: string): 'none' | 'play' | 'still' {
  if (!dayDone) return 'none';
  return playedOn === today ? 'still' : 'play';
}

/** `happy` une fois par tâche et par jour : vrai si cette coche n'a pas déjà fait réagir le panda aujourd'hui. */
export function firstCheckToday(seen: readonly string[], taskId: string, today: string): boolean {
  return !seen.includes(`${today}:${taskId}`);
}

/** Mémoire des coches déjà célébrées : seulement celles du jour (le reste est purgé). */
export function rememberCheck(seen: readonly string[], taskId: string, today: string): string[] {
  const key = `${today}:${taskId}`;
  const kept = seen.filter((k) => k.startsWith(`${today}:`) && k !== key);
  return [...kept, key];
}

/**
 * Fin de journée appliquée à l'état (pure, déterministe) : réveil si la journée n'est plus finie ; image endormie si le coucher est déjà joué
 * aujourd'hui (ou en images fixes) ; sinon le coucher démarre dès que possible — tout de suite au repos ou pendant `curious`, à la fin d'un
 * `happy` commencé (l'écran réapplique cette règle à chaque changement : aucune attente à gérer).
 */
export function applyDayPlan(s: PandaAnimState, plan: 'none' | 'play' | 'still', stillsOnly: boolean, canSleep: boolean): PandaAnimState {
  if (!canSleep || plan === 'none') return wake(s);
  if (plan === 'still' || stillsOnly) return restAsleep(s);
  if (s.asleep || s.current === 'sleep' || s.current === 'happy') return s;
  return start(s, 'sleep');
}

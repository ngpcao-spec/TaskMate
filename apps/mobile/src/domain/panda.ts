import { ageFromBirthDate } from './age';

/** Règles du compagnon panda (D-104) : calculs purs, mêmes cas que `companion_stage` / `companion_level` côté SQL. */

export type PandaStage = 1 | 2 | 3 | 4;
export type StageOffset = -1 | 0 | 1;
export const STAGE_OFFSETS: readonly StageOffset[] = [-1, 0, 1];

export const PANDA_TRAITS = ['curious', 'persistent', 'kind', 'brave', 'funny', 'calm'] as const;
export type PandaTrait = (typeof PANDA_TRAITS)[number];
export const isPandaTrait = (v: unknown): v is PandaTrait => typeof v === 'string' && (PANDA_TRAITS as readonly string[]).includes(v);

export const PANDA_NAME_MAX = 20;
export const DEFAULT_PANDA_NAME = 'Bambou';
/** Nom et trait du panda quand l'enfant passe l'étape de création. */
export const SKIPPED_PANDA_NAME = 'Panda';
export const SKIPPED_PANDA_TRAIT: PandaTrait = 'kind';

/** Nom saisi nettoyé (espaces retirés) ; `null` si vide ou trop long. */
export function cleanPandaName(raw: string): string | null {
  const name = raw.trim();
  return name.length >= 1 && name.length <= PANDA_NAME_MAX ? name : null;
}

// ───────────── Stade ─────────────

/** 1er septembre de l'année scolaire (1er sept → 31 août) qui contient `today` (`YYYY-MM-DD`, jour LOCAL de la famille). */
export function schoolYearStart(today: string): string {
  const [y, m] = today.split('-').map(Number) as [number, number, number];
  return `${m >= 9 ? y : y - 1}-09-01`;
}

/** Stade d'après l'âge révolu au 1er septembre de l'année scolaire en cours : < 6 → 1, 6–10 → 2, 11–14 → 3, ≥ 15 → 4. */
export function baseStage(birthDate: string, today: string): PandaStage {
  const age = ageFromBirthDate(birthDate, schoolYearStart(today));
  return age < 6 ? 1 : age <= 10 ? 2 : age <= 14 ? 3 : 4;
}

/** Stade final : stade de l'âge + décalage choisi par l'ENFANT (−1, 0, +1), borné à 1..4. */
export function pandaStage(birthDate: string, today: string, offset: number = 0): PandaStage {
  const raw = Math.trunc(offset);
  const shift = Number.isFinite(raw) ? Math.max(-1, Math.min(1, raw)) : 0;
  return Math.max(1, Math.min(4, baseStage(birthDate, today) + shift)) as PandaStage;
}

// ───────────── Énergie ─────────────

export const ENERGY_TASK_CHECKED = 5;
export const ENERGY_QUIZ_VALIDATED = 10;

/** Variation d'énergie quand l'enfant coche (+5) ou décoche (−5) une tâche. */
export const energyForToggle = (completed: boolean): number => (completed ? ENERGY_TASK_CHECKED : -ENERGY_TASK_CHECKED);

/** Total après une variation : jamais sous 0. */
export const applyEnergy = (total: number, delta: number): number => Math.max(0, total + delta);

export type FriendshipProgress = {
  level: number;
  /** énergie à partir de laquelle ce niveau commence */
  from: number;
  /** énergie à partir de laquelle commence le niveau suivant */
  next: number;
  /** énergie gagnée dans ce niveau */
  into: number;
  /** énergie à gagner dans ce niveau */
  span: number;
  /** 0..1 */
  progress: number;
};

const LEVEL_STARTS = [0, 50, 150, 300, 500] as const;
const LEVEL_STEP = 300;

const levelStart = (level: number): number => (level <= LEVEL_STARTS.length ? LEVEL_STARTS[level - 1]! : 500 + LEVEL_STEP * (level - LEVEL_STARTS.length));

/** Niveau d'amitié (« thân thiết ») : 1 à 0, 2 à 50, 3 à 150, 4 à 300, 5 à 500, puis un niveau de plus tous les 300. */
export function friendshipLevel(total: number): FriendshipProgress {
  const t = Math.max(0, Math.floor(Number.isFinite(total) ? total : 0));
  const level = t < 500 ? LEVEL_STARTS.filter((s) => t >= s).length : 5 + Math.floor((t - 500) / LEVEL_STEP);
  const from = levelStart(level);
  const next = levelStart(level + 1);
  const into = t - from;
  const span = next - from;
  return { level, from, next, into, span, progress: span > 0 ? Math.min(1, into / span) : 0 };
}

// ───────────── Humeur du panda ─────────────

export type PandaMood = 'calme' | 'content' | 'tres-heureux' | 'fier' | 'dort';
/** Heure locale (incluse) à partir de laquelle le panda s'endort quand rien n'est encore fait. */
export const SLEEP_HOUR = 20;

/**
 * Humeur DU PANDA (l'enfant ne saisit rien), d'après les tâches du jour local : aucune faite → calme (ou dort dès 20 h) ; ≥ 1 → content ;
 * plus de la moitié → très heureux ; toutes (au moins une prévue) → fier. Jamais triste, affamé ni culpabilisant.
 */
export function pandaMood(done: number, total: number, localHour: number): PandaMood {
  if (done <= 0) return localHour >= SLEEP_HOUR ? 'dort' : 'calme';
  if (total > 0 && done >= total) return 'fier';
  if (done * 2 > total) return 'tres-heureux';
  return 'content';
}

/** Image d'expression correspondant à l'humeur (« calme » = visage content). */
export type PandaExpression = 'content' | 'tres-heureux' | 'surpris' | 'reflechit' | 'dort' | 'fier';
export const expressionForMood = (mood: PandaMood): PandaExpression => (mood === 'calme' ? 'content' : mood);

/** Heure locale (0..23) de la famille à partir de `HH:MM`. */
export const localHourOf = (hhmm: string): number => Number(hhmm.split(':')[0] ?? 0);

// ───────────── État renvoyé par `companion_state` ─────────────

export type CompanionState = {
  hasCompanion: boolean;
  name: string | null;
  trait: PandaTrait | null;
  stage: PandaStage;
  stageOffset: StageOffset;
  energyTotal: number;
  level: number;
  nextLevelAt: number;
};

const asStage = (n: unknown): PandaStage => (n === 2 || n === 3 || n === 4 ? n : 1);
const asOffset = (n: unknown): StageOffset => (n === -1 || n === 1 ? n : 0);

/** Lit la réponse JSON de `companion_state` (valeurs inattendues ramenées à des valeurs sûres). */
export function parseCompanionState(raw: unknown): CompanionState {
  const r = (raw ?? {}) as Record<string, unknown>;
  const energy = typeof r.energy_total === 'number' && r.energy_total > 0 ? Math.floor(r.energy_total) : 0;
  const progress = friendshipLevel(energy);
  return {
    hasCompanion: r.has_companion === true,
    name: typeof r.name === 'string' ? r.name : null,
    trait: isPandaTrait(r.trait) ? r.trait : null,
    stage: asStage(r.stage),
    stageOffset: asOffset(r.stage_offset),
    energyTotal: energy,
    level: typeof r.level === 'number' && r.level >= 1 ? Math.floor(r.level) : progress.level,
    nextLevelAt: typeof r.next_level_at === 'number' ? r.next_level_at : progress.next,
  };
}

/** État du panda après une variation d'énergie (affichage optimiste avant la réponse du serveur) : total ≥ 0, niveau et palier recalculés. */
export function withEnergy(state: CompanionState, delta: number): CompanionState {
  const energyTotal = applyEnergy(state.energyTotal, delta);
  const progress = friendshipLevel(energyTotal);
  return { ...state, energyTotal, level: progress.level, nextLevelAt: progress.next };
}

/** Le panda se montre en pied (pose du stade, qui grandit avec l'âge) quand il est calme ou content ; les autres humeurs montrent l'expression. */
export const usesStagePose = (mood: PandaMood): boolean => mood === 'calme' || mood === 'content';

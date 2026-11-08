import type { AdventureState } from './adventure';

/**
 * « Le grand départ » (V2, D-107) : affichage et enchaînements du départ et du retour d'aventure. Calculs PURS seulement : les règles (jauge, niveau,
 * une aventure à la fois, retour le lendemain, trouvaille tirée par le serveur) restent celles du lot 2 (D-105) et de D-106, jugées par le serveur.
 */

/** Durées de la séquence de départ (≈ 4 s, passable d'un toucher) et de l'entrée du panda au retour. */
export const TRACE_MS = 1500;
/** Petit rebond de la tête du panda sur la clairière, après le tracé (total sur la carte ≈ 1,8 s). */
export const ARRIVE_MS = 300;
export const MAP_SEQUENCE_MS = TRACE_MS + ARRIVE_MS;
/** Le panda quitte la maison par la droite (Hôm nay). */
export const WALK_OUT_MS = 2000;
/** Au retour, le panda entre par la gauche et s'arrête au centre. */
export const WALK_IN_MS = 1500;

/** État d'affichage du voyage : jauge en cours, jauge pleine, en voyage, rentré (paquet à ouvrir), paquet ouvert (trouvaille affichée). */
export type TripView = 'filling' | 'ready' | 'away' | 'back' | 'opened';

/** Mémoire locale (par enfant) des aventures dont l'entrée a été jouée et dont le paquet a été ouvert : rien ne se rejoue. */
export type TripMemory = { entered: string[]; opened: string[] };
export const EMPTY_TRIP_MEMORY: TripMemory = { entered: [], opened: [] };
const KEEP = 10;

export function parseTripMemory(raw: string | null | undefined): TripMemory {
  if (!raw) return EMPTY_TRIP_MEMORY;
  try {
    const v = JSON.parse(raw) as Partial<Record<keyof TripMemory, unknown>>;
    const ids = (x: unknown) => (Array.isArray(x) ? x.filter((s): s is string => typeof s === 'string').slice(-KEEP) : []);
    return { entered: ids(v.entered), opened: ids(v.opened) };
  } catch {
    return EMPTY_TRIP_MEMORY;
  }
}
const add = (list: readonly string[], id: string): string[] => [...list.filter((x) => x !== id), id].slice(-KEEP);
export const rememberEntered = (m: TripMemory, id: string): TripMemory => (m.entered.includes(id) ? m : { ...m, entered: add(m.entered, id) });
export const rememberOpened = (m: TripMemory, id: string): TripMemory => (m.opened.includes(id) ? m : { entered: add(m.entered, id), opened: add(m.opened, id) });

/**
 * État d'affichage. `revealing` : aventure dont le paquet vient d'être ouvert À L'ÉCRAN (trouvaille affichée jusqu'à « Cất vào sổ ») ; le serveur
 * l'a déjà récupérée (`filling` ou `ready_to_go`), l'écran garde la trouvaille tant que l'enfant ne l'a pas rangée.
 */
export function tripView(state: Pick<AdventureState, 'state' | 'active'> | null | undefined, memory: TripMemory, revealing: string | null): TripView {
  if (revealing) return 'opened';
  if (!state) return 'filling';
  if (state.state === 'back') return state.active && memory.opened.includes(state.active.id) ? 'filling' : 'back';
  if (state.state === 'away') return 'away';
  return state.state === 'ready_to_go' ? 'ready' : 'filling';
}

/** Retour : l'entrée du panda se joue UNE fois par aventure ; ensuite (app rouverte) il attend au centre avec le paquet fermé. */
export const returnStep = (adventureId: string, memory: TripMemory): 'enter' | 'gift' | 'done' =>
  memory.opened.includes(adventureId) ? 'done' : memory.entered.includes(adventureId) ? 'gift' : 'enter';

/** Pourquoi « Lên đường! » est inactif : `null` = départ possible. `missing` = énergie qui manque (« Còn {n} ⚡ nữa là đi được! »). */
export type DepartureBlock = { kind: 'missing'; energy: number } | { kind: 'busy' } | { kind: 'pending' } | null;
export function departureBlock(state: Pick<AdventureState, 'state' | 'gauge' | 'cost'>, pending: boolean): DepartureBlock {
  if (state.state === 'away' || state.state === 'back') return { kind: 'busy' };
  if (pending) return { kind: 'pending' };
  if (state.state !== 'ready_to_go') return { kind: 'missing', energy: Math.max(1, state.cost - state.gauge) };
  return null;
}

/** Avancée 0..1 d'une étape animée (`elapsed` depuis son début) ; « réduire les animations » : directement la fin. */
export function stepProgress(elapsedMs: number, durationMs: number, reduceMotion = false): number {
  if (reduceMotion || durationMs <= 0 || !Number.isFinite(elapsedMs)) return 1;
  return Math.max(0, Math.min(1, elapsedMs / durationMs));
}
/** Accélère puis ralentit (tracé, marche). */
export const easeInOut = (p: number): number => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);

// ───────────── Trajet sur la carte ─────────────

export type Point = { x: number; y: number };

/**
 * Courbe douce de `home` à la clairière : une parabole (Bézier quadratique) dont le point de contrôle est écarté du milieu, perpendiculairement,
 * d'un quart de la distance (toujours du même côté : le trajet s'arrondit vers le haut de la carte).
 */
export function tripControl(a: Point, b: Point): Point {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return { x: mx, y: my };
  let nx = -dy / len;
  let ny = dx / len;
  if (ny > 0) {
    nx = -nx;
    ny = -ny;
  }
  return { x: mx + nx * len * 0.25, y: my + ny * len * 0.25 };
}

export function curvePoint(a: Point, b: Point, t: number): Point {
  const c = tripControl(a, b);
  const u = 1 - t;
  return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y };
}

/** Pointillé : `n` points régulièrement espacés en paramètre, de `a` (inclus) à `b` (inclus). */
export function curveDots(a: Point, b: Point, n: number): Point[] {
  const count = Math.max(2, Math.floor(n));
  return Array.from({ length: count }, (_, i) => curvePoint(a, b, i / (count - 1)));
}

/**
 * Point d'une image affichée en `cover` (centrée) dans une boîte : position en px d'un point donné en fraction de l'image (porte de la maison).
 * `ratio` = hauteur / largeur de l'image.
 */
export function coverPoint(box: { width: number; height: number }, ratio: number, f: Point): Point {
  const scale = Math.max(box.width, box.height / ratio);
  const shownW = scale;
  const shownH = scale * ratio;
  return { x: f.x * shownW - (shownW - box.width) / 2, y: f.y * shownH - (shownH - box.height) / 2 };
}

/**
 * Taille d'écriture du mot épinglé (D-107) : le message tient en `lines` lignes (2) sur la largeur utile du papier ; borné à 6..11 pt (l'image
 * est petite : le texte entier reste dans le libellé accessible et la carte postale).
 */
export function noteFontSize(text: string, width: number, lines = 2): number {
  const chars = Math.max(1, text.trim().length);
  // largeur moyenne d'un caractère Nunito italique ≈ 0,52 × la taille
  const fit = (width * lines) / (chars * 0.52);
  return Math.max(6, Math.min(11, Math.floor(fit * 10) / 10));
}

/** Aventures du panda (D-105) : calculs purs. Le serveur (`adventure_state`, `adventure_start`, `adventure_collect`) reste seul juge. */

/** Énergie à accumuler (depuis le dernier départ) pour partir. Partir ne retire AUCUNE énergie au total (D-104). */
export const ADVENTURE_COST = 60;

export type AdventureStateName = 'filling' | 'ready_to_go' | 'away' | 'back';

/** Jauge = énergie totale actuelle − `energy_mark` de la dernière aventure (0 sans aventure), bornée à 0..60 (D-106). */
export function adventureGauge(energyTotal: number, lastMark: number | null | undefined): number {
  const raw = Math.floor(energyTotal) - Math.floor(lastMark ?? 0);
  return Number.isFinite(raw) ? Math.max(0, Math.min(ADVENTURE_COST, raw)) : 0;
}

/** Ajoute `days` jours à une date `YYYY-MM-DD` (jour LOCAL : arithmétique de calendrier, jamais d'UTC ni d'heure d'été). */
export function addDays(day: string, days: number): string {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}

/** Jour de retour : le lendemain du départ, en jour local de la famille. */
export const returnsOn = (departedOn: string): string => addDays(departedOn, 1);

export type CatalogDestination = { slug: string; minLevel: number; discoveries: string[] };

/** Destinations débloquées par le niveau d'amitié, dans l'ordre du catalogue (venu de la base). */
export const unlockedDestinations = (catalog: readonly CatalogDestination[], level: number): string[] =>
  catalog.filter((d) => d.minLevel <= level).map((d) => d.slug);

export const isUnlocked = (destination: CatalogDestination, level: number): boolean => destination.minLevel <= level;

export type ActiveAdventure = {
  id: string;
  destination: string;
  departedOn: string;
  returnsOn: string;
  /** Instant du départ (ISO, serveur) ; absent d'une réponse ancienne ou d'un départ encore hors ligne. */
  departedAt?: string | null;
};

/** État affiché : aventure en cours (en voyage avant `returns_on`, rentrée ensuite) ; sinon jauge pleine ou en cours de remplissage. */
export function adventureStateName(active: ActiveAdventure | null, today: string, gauge: number): AdventureStateName {
  if (active) return today < active.returnsOn ? 'away' : 'back';
  return gauge >= ADVENTURE_COST ? 'ready_to_go' : 'filling';
}

export type FoundDiscovery = { slug: string; timesFound: number };
export type LastAdventure = { id: string; destination: string; discoverySlug: string; duplicate: boolean };

export type AdventureState = {
  gauge: number;
  cost: number;
  state: AdventureStateName;
  level: number;
  today: string | null;
  active: ActiveAdventure | null;
  last: LastAdventure | null;
  unlocked: string[];
  destinations: CatalogDestination[];
  found: FoundDiscovery[];
  foundCount: number;
  totalCount: number;
};

const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);
const int = (v: unknown, fallback = 0): number => (typeof v === 'number' && Number.isFinite(v) ? Math.floor(v) : fallback);
const STATES: readonly AdventureStateName[] = ['filling', 'ready_to_go', 'away', 'back'];

/** Lit la réponse de `adventure_state` (valeurs inattendues ramenées à des valeurs sûres). */
export function parseAdventureState(raw: unknown): AdventureState {
  const r = (raw ?? {}) as Record<string, unknown>;
  const a = r.active as Record<string, unknown> | null | undefined;
  const l = r.last as Record<string, unknown> | null | undefined;
  const active =
    a && str(a.id) && str(a.destination) && str(a.departed_on) && str(a.returns_on)
      ? { id: str(a.id)!, destination: str(a.destination)!, departedOn: str(a.departed_on)!, returnsOn: str(a.returns_on)!, departedAt: str(a.departed_at) }
      : null;
  const last =
    l && str(l.id) && str(l.destination) && str(l.discovery_slug)
      ? { id: str(l.id)!, destination: str(l.destination)!, discoverySlug: str(l.discovery_slug)!, duplicate: l.duplicate === true }
      : null;
  const destinations = (Array.isArray(r.destinations) ? r.destinations : []).flatMap((d) => {
    const x = (d ?? {}) as Record<string, unknown>;
    const slug = str(x.slug);
    return slug ? [{ slug, minLevel: Math.max(1, int(x.min_level, 1)), discoveries: (Array.isArray(x.discoveries) ? x.discoveries : []).filter((s): s is string => typeof s === 'string') }] : [];
  });
  const found = (Array.isArray(r.found) ? r.found : []).flatMap((f) => {
    const x = (f ?? {}) as Record<string, unknown>;
    const slug = str(x.slug);
    return slug ? [{ slug, timesFound: Math.max(1, int(x.times_found, 1)) }] : [];
  });
  const cost = int(r.cost, ADVENTURE_COST) || ADVENTURE_COST;
  const gauge = Math.max(0, Math.min(cost, int(r.gauge)));
  const today = str(r.today);
  const state = STATES.includes(r.state as AdventureStateName) ? (r.state as AdventureStateName) : adventureStateName(active, today ?? '', gauge);
  return {
    gauge,
    cost,
    state,
    level: Math.max(1, int(r.level, 1)),
    today,
    active,
    last,
    unlocked: (Array.isArray(r.unlocked) ? r.unlocked : []).filter((s): s is string => typeof s === 'string'),
    destinations,
    found,
    foundCount: int(r.found_count, found.length),
    totalCount: int(r.total_count, destinations.reduce((n, d) => n + d.discoveries.length, 0)),
  };
}

/** Carnet : pour chaque destination, ses trouvailles (obtenues ou non, avec le nombre de fois). */
export type JournalSection = { destination: string; items: { slug: string; timesFound: number }[] };
export function journalSections(state: Pick<AdventureState, 'destinations' | 'found'>): JournalSection[] {
  const times = new Map(state.found.map((f) => [f.slug, f.timesFound]));
  return state.destinations.map((d) => ({ destination: d.slug, items: d.discoveries.map((slug) => ({ slug, timesFound: times.get(slug) ?? 0 })) }));
}

/** Codes d'erreur des écritures d'aventure : réponse douce (message), ou abandon silencieux (double appui). */
export const SILENT_ADVENTURE_ERRORS = ['adventure_in_progress'] as const;
export const SOFT_ADVENTURE_ERRORS = ['gauge_not_full', 'destination_locked', 'not_back_yet', 'adventure_not_found', 'destination_not_found', 'forbidden'] as const;
/** Clé i18n du message doux d'une écriture d'aventure refusée ; `null` = abandon sans message. */
export function adventureErrorKey(code: string): string | null {
  if ((SILENT_ADVENTURE_ERRORS as readonly string[]).includes(code)) return null;
  if (code === 'gauge_not_full' || code === 'destination_locked' || code === 'not_back_yet') return `adventure.errors.${code}`;
  return 'adventure.errors.generic';
}

// ───────────── Voyage en cours (V2, D-106) ─────────────

/** Heure LOCALE du « lendemain matin » où le chemin du panda arrive au « ? ». */
export const RETURN_MORNING = '07:00';

/**
 * Avancée du panda sur son chemin pendant `away` (0 = départ ⚡, 1 = arrivée « ? ») : fraction du temps écoulé entre le départ et le lendemain matin
 * (`RETURN_MORNING`, jour LOCAL `returnsOn` de la famille). `morningInstant` = instant UTC de ce matin-là (calculé par l'appelant, avec le fuseau).
 * Sans heure de départ connue (réponse ancienne, départ encore hors ligne) : 0.
 */
export function awayProgress(departedAtMs: number | null, morningInstantMs: number, nowMs: number): number {
  if (departedAtMs === null || !Number.isFinite(departedAtMs) || !Number.isFinite(morningInstantMs) || !Number.isFinite(nowMs)) return 0;
  const span = morningInstantMs - departedAtMs;
  if (span <= 0) return 1;
  return Math.max(0, Math.min(1, (nowMs - departedAtMs) / span));
}

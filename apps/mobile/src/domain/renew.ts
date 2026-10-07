import type { TaskRow } from '@/types/models';
import type { RecurrenceFields, TaskInsertFields } from './task-form';

/**
 * Renouveler une tâche (D-054) : calculs purs. Toutes les dates sont des jours calendaires `YYYY-MM-DD` du jour LOCAL de
 * la famille ; l'arithmétique passe par des composantes (année, mois, jour), jamais par un instant converti en jour.
 */

/** Plafond de tâches créées d'un coup (tous enfants et tous jours confondus). */
export const MAX_CREATED = 120;
export const MAX_SERIES_WEEKS = 52;
export const DEFAULT_SERIES_WEEKS = 4;
/** Fenêtre de génération du serveur (SPEC §5.3) : une série n'a que des occurrences matérialisées sur 14 jours glissants. */
export const SERIES_HORIZON_DAYS = 14;

const pad = (n: number) => String(n).padStart(2, '0');
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function toMs(date: string): number {
  const m = DATE_RE.exec(date);
  if (!m) throw new Error(`date invalide : ${date}`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}
function fromMs(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export const addDaysIso = (date: string, days: number): string => fromMs(toMs(date) + days * 86_400_000);
export const diffDaysIso = (from: string, to: string): number => Math.round((toMs(to) - toMs(from)) / 86_400_000);

/** Jour ISO de la semaine : 1 = lundi … 7 = dimanche (jeudi = 4). Indépendant du fuseau de l'appareil. */
export function isoWeekday(date: string): number {
  const js = new Date(toMs(date)).getUTCDay(); // 0 = dimanche
  return js === 0 ? 7 : js;
}

/** Premier jour (`YYYY-MM-01`) du mois de `date`. */
export const monthStartOf = (date: string): string => `${date.slice(0, 7)}-01`;

export function addMonths(monthStart: string, months: number): string {
  const [y, m] = [Number(monthStart.slice(0, 4)), Number(monthStart.slice(5, 7))];
  const index = y * 12 + (m - 1) + months;
  return `${Math.floor(index / 12)}-${pad((index % 12) + 1)}-01`;
}

/** Grille d'un mois, semaines de lundi à dimanche ; `null` = case hors mois. */
export function monthGrid(monthStart: string): (string | null)[][] {
  const first = monthStartOf(monthStart);
  const next = addMonths(first, 1);
  const days = diffDaysIso(first, next);
  const lead = isoWeekday(first) - 1;
  const cells: (string | null)[] = [...Array<null>(lead).fill(null), ...Array.from({ length: days }, (_, i) => addDaysIso(first, i))];
  while (cells.length % 7 !== 0) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
}

export type SeriesEnd = { kind: 'never' } | { kind: 'weeks'; weeks: number } | { kind: 'date'; date: string };

/** `ends_on` de la série : « N semaines » = N semaines complètes à partir du début (début + 7·N − 1 jours). */
export function seriesEndsOn(start: string, end: SeriesEnd): string | null {
  if (end.kind === 'never') return null;
  if (end.kind === 'date') return end.date;
  return addDaysIso(start, end.weeks * 7 - 1);
}

/** Jours (ISO 1–7) retenus entre `start` et `endsOn` inclus ; `endsOn` obligatoire (borne de sécurité 800 jours). */
export function occurrenceDates(start: string, endsOn: string, weekdays: readonly number[]): string[] {
  const set = new Set(weekdays);
  const total = Math.min(diffDaysIso(start, endsOn), 800);
  const out: string[] = [];
  for (let i = 0; i <= total; i++) {
    const day = addDaysIso(start, i);
    if (set.has(isoWeekday(day))) out.push(day);
  }
  return out;
}

type Keyed = { child_id: string; title: string; date: string; start_time: string | null; end_time: string | null };
const hhmm = (t: string | null) => (t ? t.slice(0, 5) : '');
/** Une tâche « identique » : même enfant, même titre, même jour, mêmes heures. */
export const duplicateKey = (t: Keyed): string => [t.child_id, t.title.trim().toLowerCase(), t.date, hhmm(t.start_time), hhmm(t.end_time)].join('|');

/** Copie « à faire » de la source : titre, catégorie, points, note, plage horaire ; aucun état (coche, validation, refus). */
export function copyFields(source: TaskRow, childId: string, date: string): TaskInsertFields {
  return {
    child_id: childId,
    title: source.title,
    category: source.category,
    note: source.note,
    date,
    time_kind: source.time_kind,
    start_time: source.start_time,
    end_time: source.end_time,
    points: source.points,
  };
}

export type Slot = { child_id: string; date: string };

export type OneOffPlan = { toCreate: TaskInsertFields[]; skipped: Slot[]; count: number; first: string | null; last: string | null; tooMany: boolean };

/** Mode « Autres jours » : une tâche ponctuelle par (enfant, jour) ; les doublons exacts ne sont pas recréés. */
export function planOneOff(input: { source: TaskRow; childIds: readonly string[]; dates: readonly string[]; existing: readonly TaskRow[] }): OneOffPlan {
  const taken = new Set(input.existing.filter((t) => t.deleted_at === null).map(duplicateKey));
  const dates = [...new Set(input.dates)].sort();
  const toCreate: TaskInsertFields[] = [];
  const skipped: Slot[] = [];
  for (const child_id of input.childIds) {
    for (const date of dates) {
      const fields = copyFields(input.source, child_id, date);
      if (taken.has(duplicateKey(fields))) skipped.push({ child_id, date });
      else toCreate.push(fields);
    }
  }
  const created = toCreate.map((t) => t.date).sort();
  return { toCreate, skipped, count: toCreate.length, first: created[0] ?? null, last: created.at(-1) ?? null, tooMany: toCreate.length > MAX_CREATED };
}

export type SeriesError = 'weekdaysRequired' | 'startPast' | 'endBeforeStart' | 'endTooFar' | 'weeksInvalid';
export type SeriesRow = RecurrenceFields & { ends_on: string | null };
export type SeriesPlan = {
  error: SeriesError | null;
  series: SeriesRow[];
  endsOn: string | null;
  /** Tâches de la série (tous enfants) : fini → total ; sans fin → null (le serveur génère 14 jours à l'avance). */
  count: number | null;
  /** Tâches générées sur les 14 prochains jours (tous enfants). */
  upcoming: number;
  first: string | null;
  last: string | null;
  /** Occurrences des 14 prochains jours qui existent déjà à l'identique (le moteur les doublerait). */
  conflicts: Slot[];
  tooMany: boolean;
};

/** Mode « Chaque semaine » : une récurrence (moteur existant) par enfant. */
export function planSeries(input: {
  source: TaskRow;
  childIds: readonly string[];
  weekdays: readonly number[];
  start: string;
  end: SeriesEnd;
  today: string;
  existing: readonly TaskRow[];
}): SeriesPlan {
  const weekdays = [...new Set(input.weekdays)].filter((d) => d >= 1 && d <= 7).sort((a, b) => a - b);
  const empty = (error: SeriesError): SeriesPlan => ({ error, series: [], endsOn: null, count: null, upcoming: 0, first: null, last: null, conflicts: [], tooMany: false });
  if (weekdays.length === 0) return empty('weekdaysRequired');
  if (input.start < input.today) return empty('startPast');
  if (input.end.kind === 'weeks' && (!Number.isInteger(input.end.weeks) || input.end.weeks < 1 || input.end.weeks > MAX_SERIES_WEEKS)) return empty('weeksInvalid');
  const endsOn = seriesEndsOn(input.start, input.end);
  if (endsOn !== null && endsOn < input.start) return empty('endBeforeStart');
  if (endsOn !== null && diffDaysIso(input.start, endsOn) > MAX_SERIES_WEEKS * 7) return empty('endTooFar');

  const windowEnd = addDaysIso(input.start, SERIES_HORIZON_DAYS - 1);
  const upcomingEnd = endsOn !== null && endsOn < windowEnd ? endsOn : windowEnd;
  const upcomingDays = occurrenceDates(input.start, upcomingEnd, weekdays);
  const allDays = endsOn === null ? null : occurrenceDates(input.start, endsOn, weekdays);
  const children = input.childIds.length;

  const taken = new Set(input.existing.filter((t) => t.deleted_at === null).map(duplicateKey));
  const conflicts: Slot[] = [];
  for (const child_id of input.childIds) {
    for (const date of upcomingDays) if (taken.has(duplicateKey(copyFields(input.source, child_id, date)))) conflicts.push({ child_id, date });
  }

  const { date: _date, ...base } = copyFields(input.source, '', input.start);
  const series: SeriesRow[] = input.childIds.map((child_id) => ({ ...base, child_id, rule: 'weekdays', weekdays, starts_on: input.start, ends_on: endsOn }));
  const count = allDays === null ? null : allDays.length * children;
  const first = (allDays ?? upcomingDays)[0] ?? null;
  const last = allDays === null ? null : (allDays.at(-1) ?? null);
  return { error: null, series, endsOn, count, upcoming: upcomingDays.length * children, first, last, conflicts, tooMany: (count ?? upcomingDays.length * children) > MAX_CREATED };
}

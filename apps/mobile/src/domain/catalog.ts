import { shiftDay } from '@/domain/calendar';
import { defaultDueOn } from '@/domain/quiz-week';

/**
 * Catalogue de QCM de l'administrateur (D-080) : calculs purs. Les dates sont des JOURS LOCAUX de la famille (`YYYY-MM-DD`), jamais dérivées d'un
 * timestamp UTC : « aujourd'hui » vient de `todayInTz(now, fuseau de la famille)`. Le serveur reste l'autorité (même calcul dans `catalog_for_child`).
 */

export const COUNTRIES = ['VN', 'FR'] as const;
export type Country = (typeof COUNTRIES)[number];
export const isCountry = (v: string | null | undefined): v is Country => !!v && (COUNTRIES as readonly string[]).includes(v);

/** Matières proposées (liste fixée dans le code, libellés vi/fr/en dans `catalog.subject.*`). La base accepte toute clé `[a-z][a-z_]{1,29}`. */
export const SUBJECTS = ['hist_geo', 'maths', 'langue_nationale', 'anglais', 'sciences', 'civics', 'technology'] as const;
export type Subject = (typeof SUBJECTS)[number];
export const isSubject = (v: string): v is Subject => (SUBJECTS as readonly string[]).includes(v);
/** Clé i18n d'une matière du catalogue ; null si elle n'est pas dans la liste (on affiche alors la clé brute). */
export const subjectLabelKey = (subject: string): string | null => (isSubject(subject) ? `catalog.subject.${subject}` : null);

/** Décalage maximal par enfant et par matière (en semaines), des deux côtés : bornes de la base. */
export const MAX_WEEK_OFFSET = 4;
export const clampOffset = (n: number): number => Math.max(-MAX_WEEK_OFFSET, Math.min(MAX_WEEK_OFFSET, Math.trunc(n)));
/** Peut-on décaler d'UNE semaine (−1 ou +1) sans sortir des bornes ? */
export const canShift = (offset: number, delta: -1 | 1): boolean => Math.abs(offset + delta) <= MAX_WEEK_OFFSET;

/**
 * Classes : LISTE FERMÉE par pays (D-081). Une valeur libre créerait des classes distinctes (« 5 », « 5e », « lớp 5 ») et les enfants ne recevraient pas leurs QCM.
 * VN : 1 à 12 ; FR : CP, CE1, CE2, CM1, CM2, 6E, 5E, 4E, 3E, 2DE, 1RE, TERM. La base applique la MÊME liste (`catalog_normalize_grade`).
 */
export const GRADES: Record<Country, readonly string[]> = {
  VN: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'],
  FR: ['CP', 'CE1', 'CE2', 'CM1', 'CM2', '6E', '5E', '4E', '3E', '2DE', '1RE', 'TERM'],
};
/** Toutes les classes d'un pays (liste vide pour un pays inconnu). */
export const gradesFor = (country: string | null | undefined): readonly string[] => (isCountry(country) ? GRADES[country] : []);
export const isGradeOf = (country: string | null | undefined, grade: string | null | undefined): boolean => !!grade && gradesFor(country).includes(grade);

/**
 * Saisie tolérante → classe canonique du pays, ou null si elle n'existe pas. VN : « 5 », « lớp 5 », « Lớp 5 », « classe 5 » → « 5 ». FR : « 5e », « 5ème », « 5eme »,
 * « 5° » → « 5E » ; « cm2 » → « CM2 » ; « seconde », « 2nde » → « 2DE » ; « première », « 1ère » → « 1RE » ; « terminale », « tle » → « TERM ». Un nombre seul n'est PAS une
 * classe française (ambigu). Miroir exact de `public.catalog_normalize_grade` (testé des deux côtés sur les mêmes cas).
 */
export function normalizeGradeFor(country: string | null | undefined, raw: string | null | undefined): string | null {
  if (!isCountry(country) || raw == null) return null;
  let s = raw.trim().toLowerCase();
  s = s.replace(/^(l[^\s\d]{1,3}p|classe|class|grade|niveau)[\s:.-]*/u, '');
  s = s.replace(/[\s._-]/g, '');
  if (country === 'VN') {
    const m = /^0?([1-9]|1[0-2])$/.exec(s);
    return m ? (m[1] as string) : null;
  }
  if (s === 'cp') return 'CP';
  let m = /^(ce|cm)([12])$/.exec(s);
  if (m) return `${(m[1] as string).toUpperCase()}${m[2]}`;
  m = /^([3-6])(e|è|eme|ème|°)$/.exec(s);
  if (m) return `${m[1]}E`;
  if (/^(2de|2nde|2d|seconde)$/.test(s)) return '2DE';
  if (/^(1re|1ere|1ère|premiere|première)$/.test(s)) return '1RE';
  if (/^(term|tle|terminale)$/.test(s)) return 'TERM';
  return null;
}

export type CatalogDates = { releaseOn: string | null; dueOn: string | null };
/** Dates effectives pour un enfant : mise à disposition ET échéance décalées de 7 jours × décalage. */
export function effectiveDates(d: CatalogDates, offset: number): CatalogDates {
  const days = 7 * clampOffset(offset);
  return { releaseOn: d.releaseOn ? shiftDay(d.releaseOn, days) : null, dueOn: d.dueOn ? shiftDay(d.dueOn, days) : null };
}

/** Disponible = publié, avec une mise à disposition (décalée) <= JOUR LOCAL de la famille. L'échéance n'intervient jamais. */
export function isAvailable(releaseOn: string | null | undefined, offset: number, today: string): boolean {
  if (!releaseOn) return false;
  return shiftDay(releaseOn, 7 * clampOffset(offset)) <= today;
}

/** État affiché à l'ADMIN : brouillon, planifié (publié, pas encore ouvert), en cours, terminé (échéance passée). Information seulement. */
export type AdminQuizState = 'draft' | 'scheduled' | 'open' | 'ended';
export function adminQuizState(q: { status: 'draft' | 'published'; releaseOn: string | null; dueOn: string | null }, today: string): AdminQuizState {
  if (q.status !== 'published') return 'draft';
  if (q.releaseOn && q.releaseOn > today) return 'scheduled';
  if (q.dueOn && q.dueOn < today) return 'ended';
  return 'open';
}

/** Dates proposées quand l'admin choisit la mise à disposition : échéance = le dimanche qui suit (comme D-079). */
export function suggestedDates(releaseOn: string): CatalogDates {
  return { releaseOn, dueOn: defaultDueOn(releaseOn) };
}

export type CatalogFilter = { country?: string | null; grade?: string | null; subject?: string | null };
export function filterCatalog<T extends { country: string; grade: string; subject: string }>(list: readonly T[], f: CatalogFilter): T[] {
  return list.filter((q) => (!f.country || q.country === f.country) && (!f.grade || q.grade === f.grade) && (!f.subject || q.subject === f.subject));
}

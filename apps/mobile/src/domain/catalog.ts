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

/** Classe saisie → forme enregistrée (« 6e » → « 6E »). null si vide ou trop longue (12 caractères maximum). */
export function normalizeGrade(raw: string): string | null {
  const g = raw.trim().toUpperCase();
  return g.length >= 1 && g.length <= 12 ? g : null;
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
  const grade = f.grade ? normalizeGrade(f.grade) : null;
  return list.filter((q) => (!f.country || q.country === f.country) && (!grade || q.grade === grade) && (!f.subject || q.subject === f.subject));
}

/** Valeurs distinctes présentes (pour les filtres), triées : classes en ordre numérique d'abord, puis alphabétique. */
export function distinctGrades(list: readonly { grade: string }[]): string[] {
  return [...new Set(list.map((q) => q.grade))].sort((a, b) => {
    const na = Number.parseInt(a, 10);
    const nb = Number.parseInt(b, 10);
    if (Number.isNaN(na) !== Number.isNaN(nb)) return Number.isNaN(na) ? 1 : -1;
    return na !== nb && !Number.isNaN(na) ? na - nb : a.localeCompare(b);
  });
}

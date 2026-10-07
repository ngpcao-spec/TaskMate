import { addDays, addWeeks, format, parseISO, startOfWeek } from 'date-fns';
import { enUS, fr, vi } from 'date-fns/locale';
import type { Locale } from 'date-fns';
import type { TaskCategory } from '@/theme/categories';
import { CATEGORY_COLORS } from '@/theme/categories';

export type CalendarLanguage = 'vi' | 'fr' | 'en';
const LOCALES: Record<CalendarLanguage, Locale> = { vi, fr, en: enUS };

const ISO = 'yyyy-MM-dd';
const toIso = (d: Date) => format(d, ISO);

/** Lundi de la semaine contenant `date` (SPEC §3.3 : T2 → CN). `date` = `YYYY-MM-DD`. */
export function weekStart(date: string): string {
  return toIso(startOfWeek(parseISO(date), { weekStartsOn: 1 }));
}

/** Les 7 jours (lundi → dimanche) de la semaine de `date`. */
export function weekDays(date: string): string[] {
  const monday = parseISO(weekStart(date));
  return Array.from({ length: 7 }, (_, i) => toIso(addDays(monday, i)));
}

export const shiftWeek = (date: string, weeks: number): string => toIso(addWeeks(parseISO(date), weeks));
export const shiftDay = (date: string, days: number): string => toIso(addDays(parseISO(date), days));

/**
 * Titre du jour (« Thứ Năm, 2 tháng 7 ») calculé par date-fns — jamais en dur (SPEC §3.3, §8) :
 * le jour de la semaine découle de la date, pas d'une colonne.
 */
export function formatDayTitle(date: string, lang: CalendarLanguage): string {
  const title = format(parseISO(date), 'EEEE, d MMMM', { locale: LOCALES[lang] });
  // date-fns vi écrit « tháng 07 » ; la maquette/spec écrit « tháng 7 »
  return lang === 'vi' ? title.replace(/tháng 0(\d)/, 'tháng $1') : title;
}

/** Étiquette de colonne : T2…T7, CN en vietnamien. */
export function formatWeekdayLabel(date: string, lang: CalendarLanguage): string {
  return format(parseISO(date), lang === 'vi' ? 'EEEEE' : 'EEEEEE', { locale: LOCALES[lang] });
}

/** Date courte neutre « 02/07/2026 » (résumés), identique dans les trois langues. */
export const formatShortDate = (date: string): string => format(parseISO(date), 'dd/MM/yyyy');

export const formatDayNumber = (date: string): string => format(parseISO(date), 'd');

export function formatMonthTitle(date: string, lang: CalendarLanguage): string {
  const t = format(parseISO(date), 'MMMM yyyy', { locale: LOCALES[lang] });
  return lang === 'vi' ? t.replace(/tháng 0(\d)/, 'tháng $1') : t;
}

/** Carte colorée par catégorie : couleur à ~12 % d'opacité (SPEC §6.2). */
export function categoryTint(category: TaskCategory): string {
  return `${CATEGORY_COLORS[category]}1F`;
}

export function groupByDay<T extends { date: string }>(tasks: readonly T[], days: readonly string[]): Record<string, T[]> {
  const out: Record<string, T[]> = Object.fromEntries(days.map((d) => [d, []]));
  for (const t of tasks) out[t.date]?.push(t);
  return out;
}

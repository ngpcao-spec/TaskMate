import { differenceInCalendarDays, getISOWeek, parseISO } from 'date-fns';
import { shiftDay, weekStart } from '@/domain/calendar';
import { lastVisibleDay, type WeeklyItem } from '@/domain/weekly-quiz';

/**
 * Bandeau « Ôn tập » de Hôm nay et écran « Ôn tập » (D-084) : calculs purs. Tout est en JOURS LOCAUX de la famille (`YYYY-MM-DD`, comparés comme
 * des chaînes ; « aujourd'hui » vient de `todayInTz`), semaine = lundi → dimanche, rattachée à l'ÉCHÉANCE du quiz. Aucun barème ici : les points
 * (`maxPoints`, `pointsAwarded`) viennent du serveur. Le retard est une information : il ne bloque jamais l'enfant et ne coûte rien.
 */

/** Une échéance à ce nombre de jours (ou moins, retard compris) est signalée en rouge. */
export const URGENT_DAYS = 2;

/** Jours entre `today` et `day` (négatif : l'échéance est passée). */
export const daysUntil = (day: string, today: string): number => differenceInCalendarDays(parseISO(day), parseISO(today));

type Dated = Pick<WeeklyItem, 'dueOn' | 'releaseOn'>;

/** Lundi de la semaine d'un quiz : celle de son échéance (repli : son jour d'ouverture). `null` si aucune date. */
export function itemWeek(i: Dated): string | null {
  const day = i.dueOn ?? i.releaseOn;
  return day ? weekStart(day) : null;
}

export const isUnfinished = (i: Pick<WeeklyItem, 'state'>): boolean => i.state === 'todo' || i.state === 'in_progress';

const GROUP = { todo: 0, in_progress: 0, waiting: 1, validated: 2, upcoming: 3 } as const;
const FAR = '9999-12-31';

/** Cartes de l'écran : non terminées par échéance croissante, puis en attente de validation, puis validées. */
export function sortCards(items: readonly WeeklyItem[]): WeeklyItem[] {
  return [...items].sort(
    (a, b) =>
      GROUP[a.state] - GROUP[b.state] ||
      (a.dueOn ?? FAR).localeCompare(b.dueOn ?? FAR) ||
      a.subject.localeCompare(b.subject) ||
      a.title.localeCompare(b.title) ||
      a.quizId.localeCompare(b.quizId),
  );
}

/**
 * Quiz de la semaine `start` (un lundi). La semaine COURANTE reprend en plus :
 *  - ce qui reste des semaines passées : à faire / en cours pendant le délai de grâce (jusqu'à la fin de la semaine qui suit l'échéance, SANS pénalité),
 *    en attente de validation tant que le parent n'a pas validé ;
 *  - ce qui est DÉJÀ OUVERT pour les semaines suivantes (un quiz ouvert le vendredi pour un dimanche de la semaine d'après se fait dès maintenant :
 *    il ne doit pas rester invisible jusqu'au lundi).
 * Les semaines passées montrent l'historique, les semaines futures seulement ce qui est déjà ouvert (le serveur ne renvoie que cela).
 */
export function weekItems(items: readonly WeeklyItem[], start: string, today: string): WeeklyItem[] {
  const own = items.filter((i) => itemWeek(i) === start);
  if (start !== weekStart(today)) return sortCards(own);
  const others = items.filter((i) => {
    const w = itemWeek(i);
    if (!w || w === start || i.state === 'upcoming') return false; // pas encore ouvert : seulement dans SA semaine
    if (w > start) return true;
    if (i.state === 'waiting') return true;
    if (!isUnfinished(i)) return false;
    const end = lastVisibleDay(i.releaseOn, i.dueOn);
    return !!end && today <= end;
  });
  return sortCards([...own, ...others]);
}

export type WeekStats = { total: number; validated: number; waiting: number; unfinished: number };
export function weekStats(list: readonly WeeklyItem[]): WeekStats {
  return {
    total: list.length,
    validated: list.filter((i) => i.state === 'validated').length,
    waiting: list.filter((i) => i.state === 'waiting').length,
    unfinished: list.filter(isUnfinished).length,
  };
}

export type NearestDue = { item: WeeklyItem; days: number; urgent: boolean };
/** Échéance la plus proche parmi les quiz non terminés (retard compris : la plus ancienne d'abord). */
export function nearestDue(list: readonly WeeklyItem[], today: string): NearestDue | null {
  const open = sortCards(list.filter((i) => isUnfinished(i) && i.dueOn));
  const item = open[0];
  if (!item || !item.dueOn) return null;
  const days = daysUntil(item.dueOn, today);
  return { item, days, urgent: days <= URGENT_DAYS };
}

/** Numéro de semaine affiché : celui du libellé du catalogue (« Tuần 8 » → 8), le plus fréquent de la semaine ; sinon la semaine ISO. */
export function weekNumber(list: readonly WeeklyItem[], start: string): number {
  const own = list.filter((i) => itemWeek(i) === start);
  const counts = new Map<number, number>();
  for (const i of own.length > 0 ? own : list) {
    const m = /(\d+)/.exec(i.weekLabel);
    if (m) counts.set(Number(m[1]), (counts.get(Number(m[1])) ?? 0) + 1);
  }
  let best: number | null = null;
  for (const [n, c] of counts) if (best === null || c > (counts.get(best) ?? 0) || (c === (counts.get(best) ?? 0) && n < best)) best = n;
  return best ?? getISOWeek(parseISO(start));
}

export type WeekHeader = { start: string; end: string; weekNo: number; validated: number; total: number; canPrev: boolean; canNext: boolean };
/**
 * Bornes de navigation : de la plus ancienne semaine qui porte un quiz à la plus récente, y compris les quiz pas encore ouverts (la semaine courante est
 * toujours atteignable). `maxAheadWeeks` : avance maximale, en semaines, sur la semaine courante (enfant : 1 ; parent : `null` = sans limite).
 */
export function weekBounds(items: readonly WeeklyItem[], today: string, maxAheadWeeks: number | null = null): { min: string; max: string } {
  const current = weekStart(today);
  const weeks = [current, ...items.map(itemWeek).filter((w): w is string => w !== null)].sort();
  const last = weeks[weeks.length - 1] as string;
  const limit = maxAheadWeeks === null ? null : shiftDay(current, 7 * maxAheadWeeks);
  return { min: weeks[0] as string, max: limit !== null && last > limit ? limit : last };
}
export function weekHeader(items: readonly WeeklyItem[], start: string, today: string, maxAheadWeeks: number | null = null): WeekHeader {
  const list = weekItems(items, start, today);
  const { min, max } = weekBounds(items, today, maxAheadWeeks);
  return { start, end: shiftDay(start, 6), weekNo: weekNumber(list, start), validated: weekStats(list).validated, total: list.length, canPrev: start > min, canNext: start < max };
}

export type Banner = {
  weekNo: number;
  total: number;
  validated: number;
  /** Tout est validé : bandeau discret « xong ». */
  done: boolean;
  /** Quiz envoyés qui attendent le parent (toutes semaines confondues : c'est ce qu'il doit voir). */
  toValidate: number;
  waiting: number;
  nearest: NearestDue | null;
};
/** Bandeau de Hôm nay pour un enfant ; `null` s'il n'y a rien à montrer (aucun quiz cette semaine, ni en retard dans le délai de grâce, ni à valider). */
export function bannerModel(all: readonly WeeklyItem[], today: string): Banner | null {
  const items = all.filter((i) => i.state !== 'upcoming'); // un quiz pas encore ouvert n'entre jamais dans le bandeau
  const start = weekStart(today);
  const list = weekItems(items, start, today);
  const toValidate = items.filter((i) => i.state === 'waiting').length;
  if (list.length === 0) return null; // un quiz envoyé est toujours dans la liste (reporté ou ouvert d'avance) : rien à valider = rien à montrer
  const stats = weekStats(list);
  return {
    weekNo: weekNumber(list, start),
    total: stats.total,
    validated: stats.validated,
    done: stats.total > 0 && stats.validated === stats.total,
    toValidate,
    waiting: stats.waiting,
    nearest: nearestDue(list, today),
  };
}

import { addMinutes, startOfMinute } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

/** Jour local de la famille (`YYYY-MM-DD`) — jamais dérivé de l'UTC (SPEC §6.1). */
export function todayInTz(now: Date, timeZone: string): string {
  return formatInTimeZone(now, timeZone, 'yyyy-MM-dd');
}

/** Heure locale de la famille (`HH:MM`). */
export function timeInTz(now: Date, timeZone: string): string {
  return formatInTimeZone(now, timeZone, 'HH:mm');
}

/** « Prochaine demi-heure » en heure locale de la famille (défaut du formulaire, SPEC §3.4). */
export function nextHalfHour(now: Date, timeZone: string): { date: string; time: string } {
  const base = startOfMinute(now);
  const minutes = Number(formatInTimeZone(base, timeZone, 'mm'));
  const add = minutes === 0 || minutes === 30 ? 30 : minutes < 30 ? 30 - minutes : 60 - minutes;
  const next = addMinutes(base, add);
  return { date: formatInTimeZone(next, timeZone, 'yyyy-MM-dd'), time: formatInTimeZone(next, timeZone, 'HH:mm') };
}

/** Créneau par défaut du formulaire : prochaine demi-heure, durée 30 min (borné à 23:59). */
export function defaultTaskSlot(now: Date, timeZone: string): { date: string; start: string; end: string } {
  const { date, time } = nextHalfHour(now, timeZone);
  const [h, m] = time.split(':').map(Number) as [number, number];
  const endMinutes = h * 60 + m + 30;
  const end = endMinutes >= 24 * 60 ? '23:59' : `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;
  return { date, start: time, end };
}

import { addDays, format, parseISO } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';
import type { NotificationPrefs } from './notification-prefs';
import type { TimedTask } from './task-time';

export type ReminderTask = TimedTask & { id: string; title: string; deleted_at?: string | null };

export type PlannedReminder =
  | { id: string; kind: 'start'; at: Date; taskId: string; title: string; minutes: number; time: string }
  | { id: string; kind: 'deadline'; at: Date; taskId: string; title: string; minutes: number; time: string }
  | { id: string; kind: 'recap'; at: Date; date: string; count: number };

/** iOS limite à 64 notifications locales en attente : on planifie les 60 prochaines. */
export const MAX_SCHEDULED = 60;
export const HORIZON_DAYS = 7;

const hhmm = (t: string) => t.slice(0, 5);

/** Instant UTC d'un jour + heure locaux de la famille (jamais dérivé d'un offset fixe, SPEC §6.1). */
export function instantInTz(date: string, time: string, timeZone: string): Date {
  return fromZonedTime(`${date}T${hhmm(time)}:00`, timeZone);
}

/**
 * Rappels locaux de l'enfant (SPEC §5.6) : X min avant le début d'une plage, X min avant une échéance,
 * et un récap du soir quand il reste des tâches. Replanifiés à chaque synchro : une tâche ajoutée par le parent
 * (ex. 20:00) produit un rappel à 19:50 sur le téléphone de l'enfant.
 */
export function planReminders(input: {
  tasks: readonly ReminderTask[];
  prefs: NotificationPrefs;
  now: Date;
  timeZone: string;
  today: string;
}): PlannedReminder[] {
  const { tasks, prefs, now, timeZone, today } = input;
  const lastDay = format(addDays(parseISO(today), HORIZON_DAYS - 1), 'yyyy-MM-dd');
  const open = tasks.filter((t) => !t.deleted_at && t.completed_at === null && t.date >= today && t.date <= lastDay);
  const out: PlannedReminder[] = [];

  for (const t of open) {
    if (t.time_kind === 'range' && t.start_time && prefs.reminderBeforeStartMin !== null) {
      const at = new Date(instantInTz(t.date, t.start_time, timeZone).getTime() - prefs.reminderBeforeStartMin * 60_000);
      if (at > now) out.push({ id: `task:${t.id}:start`, kind: 'start', at, taskId: t.id, title: t.title, minutes: prefs.reminderBeforeStartMin, time: hhmm(t.start_time) });
    }
    if (t.time_kind === 'deadline' && t.end_time && prefs.reminderBeforeDeadlineMin !== null) {
      const at = new Date(instantInTz(t.date, t.end_time, timeZone).getTime() - prefs.reminderBeforeDeadlineMin * 60_000);
      if (at > now) out.push({ id: `task:${t.id}:deadline`, kind: 'deadline', at, taskId: t.id, title: t.title, minutes: prefs.reminderBeforeDeadlineMin, time: hhmm(t.end_time) });
    }
  }

  if (prefs.eveningRecap.enabled) {
    const perDay = new Map<string, number>();
    for (const t of open) perDay.set(t.date, (perDay.get(t.date) ?? 0) + 1);
    for (const [date, count] of perDay) {
      const at = instantInTz(date, prefs.eveningRecap.time, timeZone);
      if (at > now) out.push({ id: `recap:${date}`, kind: 'recap', at, date, count });
    }
  }

  return out.sort((a, b) => a.at.getTime() - b.at.getTime() || a.id.localeCompare(b.id)).slice(0, MAX_SCHEDULED);
}

/** Identifiants à annuler (planifiés mais plus voulus) et à (re)planifier. */
export function diffSchedule(scheduledIds: readonly string[], planned: readonly PlannedReminder[]): { cancel: string[]; keep: string[] } {
  const wanted = new Set(planned.map((p) => p.id));
  return { cancel: scheduledIds.filter((id) => !wanted.has(id)), keep: scheduledIds.filter((id) => wanted.has(id)) };
}

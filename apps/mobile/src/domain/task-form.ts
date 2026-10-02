import { z } from 'zod';
import { TASK_CATEGORIES } from '@/theme/categories';
import type { TimeKind } from '@/types/db';

export const DEFAULT_POINTS = 10;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isRealDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** Messages = clés i18n (`taskForm.errors.*`), traduites par l'UI. */
export const taskFormSchema = z
  .object({
    title: z.string().trim().min(1, 'titleRequired').max(80, 'titleTooLong'),
    category: z.enum(TASK_CATEGORIES),
    date: z.string().refine(isRealDate, 'dateInvalid'),
    timeKind: z.enum(['range', 'deadline', 'anytime']),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    note: z.string().max(500, 'noteTooLong').optional(),
    points: z.number().int('pointsInvalid').min(0, 'pointsInvalid').max(1000, 'pointsInvalid'),
    childIds: z.array(z.string()).min(1, 'childRequired'),
    /** Répétition (parent) : none | daily | weekdays + jours ISO 1 (lundi) … 7 (dimanche). */
    repeat: z.enum(['none', 'daily', 'weekdays']).optional(),
    weekdays: z.array(z.number().int().min(1).max(7)).optional(),
  })
  .superRefine((v, ctx) => {
    const bad = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message });
    if (v.repeat === 'weekdays' && (v.weekdays?.length ?? 0) === 0) bad('weekdays', 'weekdaysRequired');
    if (v.timeKind === 'range') {
      if (!v.startTime || !TIME_RE.test(v.startTime)) bad('startTime', 'timeInvalid');
      if (!v.endTime || !TIME_RE.test(v.endTime)) bad('endTime', 'timeInvalid');
      else if (v.startTime && TIME_RE.test(v.startTime) && v.endTime <= v.startTime) bad('endTime', 'endBeforeStart');
    } else if (v.timeKind === 'deadline') {
      if (!v.endTime || !TIME_RE.test(v.endTime)) bad('endTime', 'timeInvalid');
    }
  });

export type TaskFormValues = z.input<typeof taskFormSchema>;

export type TaskInsertFields = {
  child_id: string;
  title: string;
  category: z.infer<typeof taskFormSchema>['category'];
  note: string | null;
  date: string;
  time_kind: TimeKind;
  start_time: string | null;
  end_time: string | null;
  points: number;
};

/** Transforme le formulaire validé en champs de tâche (une par enfant ciblé). `deadline` → `end_time` (D-004). */
export function toTaskFields(v: z.infer<typeof taskFormSchema>, canSetPoints: boolean): TaskInsertFields[] {
  const note = v.note?.trim() ? v.note.trim() : null;
  return v.childIds.map((child_id) => ({
    child_id,
    title: v.title,
    category: v.category,
    note,
    date: v.date,
    time_kind: v.timeKind,
    start_time: v.timeKind === 'range' ? (v.startTime ?? null) : null,
    end_time: v.timeKind === 'anytime' ? null : (v.endTime ?? null),
    // un enfant ne fixe jamais les points : 10 imposé (RLS/trigger côté serveur)
    points: canSetPoints ? v.points : DEFAULT_POINTS,
  }));
}

export type RecurrenceFields = Omit<TaskInsertFields, 'date'> & {
  rule: 'daily' | 'weekdays';
  weekdays: number[] | null;
  starts_on: string;
};

/** Récurrence(s) à créer (une par enfant) quand `repeat` ≠ `none` ; `date` du formulaire = `starts_on`. */
export function toRecurrenceFields(v: z.infer<typeof taskFormSchema>, canSetPoints: boolean): RecurrenceFields[] {
  if (!v.repeat || v.repeat === 'none') return [];
  return toTaskFields(v, canSetPoints).map(({ date, ...rest }) => ({
    ...rest,
    rule: v.repeat as 'daily' | 'weekdays',
    weekdays: v.repeat === 'weekdays' ? [...new Set(v.weekdays ?? [])].sort((a, b) => a - b) : null,
    starts_on: date,
  }));
}

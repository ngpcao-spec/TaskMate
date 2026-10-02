export type NotificationPrefs = {
  /** Minutes avant le début d'une tâche « plage » ; `null` = désactivé. */
  reminderBeforeStartMin: number | null;
  /** Minutes avant une échéance « avant HH:MM » ; `null` = désactivé. */
  reminderBeforeDeadlineMin: number | null;
  eveningRecap: { enabled: boolean; time: string };
  /** Parent : activité des enfants, chacune activable (SPEC §3.9). */
  activity: { taskDone: boolean; rewardRequested: boolean; goalAchieved: boolean };
};

export const DEFAULT_PREFS: NotificationPrefs = {
  reminderBeforeStartMin: 10,
  reminderBeforeDeadlineMin: 30,
  eveningRecap: { enabled: true, time: '20:30' },
  activity: { taskDone: true, rewardRequested: true, goalAchieved: true },
};

export const MAX_REMINDER_MIN = 240;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const minutesOrDefault = (v: unknown, fallback: number | null): number | null => {
  if (v === null) return null;
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= MAX_REMINDER_MIN ? v : fallback;
};
const boolOrDefault = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);

/** Fusionne des préférences stockées (JSON non fiable) avec les valeurs par défaut : toute valeur invalide retombe sur le défaut. */
export function normalizePrefs(raw: unknown): NotificationPrefs {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const recap = (typeof r.eveningRecap === 'object' && r.eveningRecap !== null ? r.eveningRecap : {}) as Record<string, unknown>;
  const act = (typeof r.activity === 'object' && r.activity !== null ? r.activity : {}) as Record<string, unknown>;
  return {
    reminderBeforeStartMin: minutesOrDefault(r.reminderBeforeStartMin, DEFAULT_PREFS.reminderBeforeStartMin),
    reminderBeforeDeadlineMin: minutesOrDefault(r.reminderBeforeDeadlineMin, DEFAULT_PREFS.reminderBeforeDeadlineMin),
    eveningRecap: {
      enabled: boolOrDefault(recap.enabled, DEFAULT_PREFS.eveningRecap.enabled),
      time: typeof recap.time === 'string' && TIME_RE.test(recap.time) ? recap.time : DEFAULT_PREFS.eveningRecap.time,
    },
    activity: {
      taskDone: boolOrDefault(act.taskDone, DEFAULT_PREFS.activity.taskDone),
      rewardRequested: boolOrDefault(act.rewardRequested, DEFAULT_PREFS.activity.rewardRequested),
      goalAchieved: boolOrDefault(act.goalAchieved, DEFAULT_PREFS.activity.goalAchieved),
    },
  };
}

export const isValidTime = (v: string): boolean => TIME_RE.test(v);

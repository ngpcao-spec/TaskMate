import { DEFAULT_PREFS, isValidTime, normalizePrefs } from './notification-prefs';

describe('normalizePrefs', () => {
  it('valeurs par défaut du §3.9 : 10 min avant le début, 30 min avant l’échéance, récap du soir', () => {
    expect(normalizePrefs({})).toEqual(DEFAULT_PREFS);
    expect(DEFAULT_PREFS.reminderBeforeStartMin).toBe(10);
    expect(DEFAULT_PREFS.reminderBeforeDeadlineMin).toBe(30);
  });
  it('reste robuste face à du JSON douteux', () => {
    expect(normalizePrefs(null)).toEqual(DEFAULT_PREFS);
    expect(normalizePrefs('x')).toEqual(DEFAULT_PREFS);
    expect(normalizePrefs({ reminderBeforeStartMin: -5, reminderBeforeDeadlineMin: 'a', eveningRecap: { time: '25:00', enabled: 'oui' } })).toEqual(DEFAULT_PREFS);
  });
  it('conserve les valeurs valides et null (= désactivé)', () => {
    const p = normalizePrefs({ reminderBeforeStartMin: 0, reminderBeforeDeadlineMin: null, eveningRecap: { enabled: false, time: '19:15' }, activity: { taskDone: false } });
    expect(p.reminderBeforeStartMin).toBe(0);
    expect(p.reminderBeforeDeadlineMin).toBeNull();
    expect(p.eveningRecap).toEqual({ enabled: false, time: '19:15' });
    expect(p.activity).toEqual({ taskDone: false, rewardRequested: true, goalAchieved: true });
  });
  it('borne les minutes', () => {
    expect(normalizePrefs({ reminderBeforeStartMin: 241 }).reminderBeforeStartMin).toBe(10);
    expect(normalizePrefs({ reminderBeforeStartMin: 240 }).reminderBeforeStartMin).toBe(240);
    expect(normalizePrefs({ reminderBeforeStartMin: 1.5 }).reminderBeforeStartMin).toBe(10);
  });
  it('isValidTime', () => {
    expect(isValidTime('20:30')).toBe(true);
    expect(isValidTime('24:00')).toBe(false);
  });
});

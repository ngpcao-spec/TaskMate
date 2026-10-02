import { DEFAULT_PREFS } from './notification-prefs';
import { diffSchedule, instantInTz, MAX_SCHEDULED, planReminders, type ReminderTask } from './reminders';

const HCM = 'Asia/Ho_Chi_Minh';
const now = new Date('2026-07-02T03:00:00Z'); // 10:00 à Hô Chi Minh
const base = { completed_at: null, deleted_at: null } as const;
const range = (id: string, date: string, s: string, e: string): ReminderTask => ({ id, title: `T${id}`, date, time_kind: 'range', start_time: s, end_time: e, ...base });
const deadline = (id: string, date: string, e: string): ReminderTask => ({ id, title: `T${id}`, date, time_kind: 'deadline', start_time: null, end_time: e, ...base });
const anytime = (id: string, date: string): ReminderTask => ({ id, title: `T${id}`, date, time_kind: 'anytime', start_time: null, end_time: null, ...base });
const plan = (tasks: ReminderTask[], prefs = DEFAULT_PREFS) => planReminders({ tasks, prefs, now, timeZone: HCM, today: '2026-07-02' });

describe('instantInTz', () => {
  it('convertit un jour/heure locaux de la famille en instant UTC', () => {
    expect(instantInTz('2026-07-02', '20:00', HCM).toISOString()).toBe('2026-07-02T13:00:00.000Z');
    expect(instantInTz('2026-07-02', '20:00:00', 'UTC').toISOString()).toBe('2026-07-02T20:00:00.000Z');
  });
});

describe('planReminders', () => {
  it('une tâche créée par le parent pour 20:00 déclenche un rappel à 19:50 (heure famille) — critère §8', () => {
    const r = plan([range('1', '2026-07-02', '20:00:00', '20:45:00')], { ...DEFAULT_PREFS, eveningRecap: { enabled: false, time: '20:30' } });
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ kind: 'start', taskId: '1', minutes: 10, time: '20:00' });
    expect(r[0]?.at.toISOString()).toBe('2026-07-02T12:50:00.000Z'); // 19:50 à Hô Chi Minh
  });
  it('échéance : 30 min avant « avant 21:00 »', () => {
    const r = plan([deadline('1', '2026-07-02', '21:00')], { ...DEFAULT_PREFS, eveningRecap: { enabled: false, time: '20:30' } });
    expect(r[0]).toMatchObject({ kind: 'deadline', minutes: 30, time: '21:00' });
    expect(r[0]?.at.toISOString()).toBe('2026-07-02T13:30:00.000Z'); // 20:30 local
  });
  it('ignore les rappels passés, les tâches faites, supprimées, sans heure et hors horizon', () => {
    const r = plan(
      [
        range('past', '2026-07-02', '10:05', '11:00'), // rappel à 09:55 < maintenant
        { ...range('done', '2026-07-02', '20:00', '21:00'), completed_at: 'x' },
        { ...range('del', '2026-07-02', '20:00', '21:00'), deleted_at: 'x' },
        anytime('any', '2026-07-02'),
        range('far', '2026-07-20', '20:00', '21:00'),
        range('yesterday', '2026-07-01', '20:00', '21:00'),
      ],
      { ...DEFAULT_PREFS, eveningRecap: { enabled: false, time: '20:30' } },
    );
    expect(r).toEqual([]);
  });
  it('respecte les préférences (minutes personnalisées, désactivation)', () => {
    const t = [range('1', '2026-07-02', '20:00', '21:00'), deadline('2', '2026-07-02', '22:00')];
    const custom = plan(t, { ...DEFAULT_PREFS, reminderBeforeStartMin: 5, reminderBeforeDeadlineMin: null, eveningRecap: { enabled: false, time: '20:30' } });
    expect(custom.map((r) => r.id)).toEqual(['task:1:start']);
    expect(custom[0]).toMatchObject({ minutes: 5 });
    expect(plan(t, { ...DEFAULT_PREFS, reminderBeforeStartMin: null, reminderBeforeDeadlineMin: null, eveningRecap: { enabled: false, time: '20:30' } })).toEqual([]);
  });
  it('récap du soir : un par jour qui a des tâches restantes, à l’heure choisie', () => {
    const r = plan([anytime('1', '2026-07-02'), anytime('2', '2026-07-02'), anytime('3', '2026-07-04')]);
    const recaps = r.filter((x) => x.kind === 'recap');
    expect(recaps.map((x) => x.id)).toEqual(['recap:2026-07-02', 'recap:2026-07-04']);
    expect(recaps[0]).toMatchObject({ count: 2 });
    expect(recaps[0]?.at.toISOString()).toBe('2026-07-02T13:30:00.000Z'); // 20:30 local
  });
  it('pas de récap si l’heure est passée ou aucune tâche restante', () => {
    expect(plan([{ ...anytime('1', '2026-07-02'), completed_at: 'x' }])).toEqual([]);
    const late = planReminders({ tasks: [anytime('1', '2026-07-02')], prefs: DEFAULT_PREFS, now: new Date('2026-07-02T14:00:00Z'), timeZone: HCM, today: '2026-07-02' });
    expect(late).toEqual([]);
  });
  it('trie par heure et plafonne à 60 (limite iOS)', () => {
    const many = Array.from({ length: 80 }, (_, i) => range(String(i), '2026-07-03', `${String(8 + Math.floor(i / 10)).padStart(2, '0')}:${String((i % 10) * 5).padStart(2, '0')}`, '23:00'));
    const r = plan(many, { ...DEFAULT_PREFS, eveningRecap: { enabled: false, time: '20:30' } });
    expect(r).toHaveLength(MAX_SCHEDULED);
    expect([...r].sort((a, b) => a.at.getTime() - b.at.getTime())).toEqual(r);
  });
  it('identifiants stables → replanifier ne crée pas de doublon', () => {
    const a = plan([range('1', '2026-07-02', '20:00', '21:00')]);
    const b = plan([range('1', '2026-07-02', '20:00', '21:00')]);
    expect(a.map((x) => x.id)).toEqual(b.map((x) => x.id));
  });
});

describe('diffSchedule', () => {
  it('annule ce qui n’est plus voulu (tâche cochée/supprimée) et garde le reste', () => {
    const planned = plan([range('1', '2026-07-02', '20:00', '21:00')], { ...DEFAULT_PREFS, eveningRecap: { enabled: false, time: '20:30' } });
    expect(diffSchedule(['task:1:start', 'task:9:start'], planned)).toEqual({ cancel: ['task:9:start'], keep: ['task:1:start'] });
  });
});

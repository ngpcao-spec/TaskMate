import { isOverdue, sortTasks, timeLabel, type TimedTask } from './task-time';

const base = { date: '2026-07-02', completed_at: null } as const;
const range = (s: string, e: string): TimedTask => ({ ...base, time_kind: 'range', start_time: s, end_time: e });
const deadline = (e: string): TimedTask => ({ ...base, time_kind: 'deadline', start_time: null, end_time: e });
const anytime: TimedTask = { ...base, time_kind: 'anytime', start_time: null, end_time: null };
const t = (title: string, task: TimedTask) => ({ title, ...task });

describe('sortTasks', () => {
  it('trie par heure de début ou d’échéance, sans heure en dernier', () => {
    const sorted = sortTasks([
      t('libre', anytime),
      t('soir', deadline('21:00')),
      t('matin', range('08:00:00', '08:45:00')),
      t('midi', range('12:00', '12:30')),
    ]);
    expect(sorted.map((x) => x.title)).toEqual(['matin', 'midi', 'soir', 'libre']);
  });
  it('départage par titre et ne mute pas l’entrée', () => {
    const input = [t('b', anytime), t('a', anytime)];
    expect(sortTasks(input).map((x) => x.title)).toEqual(['a', 'b']);
    expect(input[0]?.title).toBe('b');
    expect(sortTasks([t('z', range('09:00', '10:00')), t('a', range('09:00', '10:00'))])[0]?.title).toBe('a');
  });
});

describe('timeLabel', () => {
  it('décrit les trois formats', () => {
    expect(timeLabel(range('08:00:00', '08:45:00'))).toEqual({ kind: 'range', start: '08:00', end: '08:45' });
    expect(timeLabel(deadline('21:00:00'))).toEqual({ kind: 'deadline', end: '21:00' });
    expect(timeLabel(anytime)).toEqual({ kind: 'anytime' });
  });
});

describe('isOverdue (§5.5)', () => {
  it('jour passé non fait → en retard', () => {
    expect(isOverdue({ ...anytime, date: '2026-07-01' }, '2026-07-02', '08:00')).toBe(true);
  });
  it('jour futur → jamais en retard', () => {
    expect(isOverdue({ ...range('08:00', '09:00'), date: '2026-07-03' }, '2026-07-02', '23:00')).toBe(false);
  });
  it('aujourd’hui : en retard seulement après end_time', () => {
    expect(isOverdue(range('08:00', '09:00'), '2026-07-02', '09:01')).toBe(true);
    expect(isOverdue(range('08:00', '09:00'), '2026-07-02', '09:00')).toBe(false);
    expect(isOverdue(deadline('21:00'), '2026-07-02', '20:59')).toBe(false);
    expect(isOverdue(anytime, '2026-07-02', '23:59')).toBe(false);
  });
  it('une tâche faite n’est jamais en retard', () => {
    expect(isOverdue({ ...anytime, date: '2026-06-01', completed_at: '2026-06-01T10:00:00Z' }, '2026-07-02', '10:00')).toBe(false);
  });
});

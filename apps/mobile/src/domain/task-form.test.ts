import { DEFAULT_POINTS, taskFormSchema, toTaskFields, type TaskFormValues } from './task-form';

const valid: TaskFormValues = {
  title: ' Bài tập Toán ',
  category: 'study',
  date: '2026-07-02',
  timeKind: 'range',
  startTime: '08:00',
  endTime: '08:45',
  note: '',
  points: 25,
  childIds: ['c1'],
};
const errors = (v: Partial<TaskFormValues>) => {
  const r = taskFormSchema.safeParse({ ...valid, ...v });
  return r.success ? [] : r.error.issues.map((i) => i.message);
};

describe('taskFormSchema', () => {
  it('accepte un formulaire valide et rogne le titre', () => {
    const r = taskFormSchema.parse(valid);
    expect(r.title).toBe('Bài tập Toán');
  });
  it('titre requis, ≤ 80', () => {
    expect(errors({ title: '   ' })).toContain('titleRequired');
    expect(errors({ title: 'x'.repeat(81) })).toContain('titleTooLong');
    expect(errors({ title: 'x'.repeat(80) })).toEqual([]);
  });
  it('note ≤ 500', () => {
    expect(errors({ note: 'x'.repeat(501) })).toContain('noteTooLong');
  });
  it('plage horaire : fin après début', () => {
    expect(errors({ endTime: '07:00' })).toContain('endBeforeStart');
    expect(errors({ startTime: '25:00' })).toContain('timeInvalid');
    expect(errors({ endTime: undefined })).toContain('timeInvalid');
  });
  it('échéance : heure requise ; anytime : aucune', () => {
    expect(errors({ timeKind: 'deadline', startTime: undefined, endTime: '21:00' })).toEqual([]);
    expect(errors({ timeKind: 'deadline', endTime: undefined })).toContain('timeInvalid');
    expect(errors({ timeKind: 'anytime', startTime: undefined, endTime: undefined })).toEqual([]);
  });
  it('date réelle, au moins un enfant, points bornés', () => {
    expect(errors({ date: '2026-02-30' })).toContain('dateInvalid');
    expect(errors({ childIds: [] })).toContain('childRequired');
    expect(errors({ points: -1 })).toContain('pointsInvalid');
    expect(errors({ points: 1.5 })).toContain('pointsInvalid');
  });
});

describe('toTaskFields', () => {
  it('crée une tâche par enfant ciblé', () => {
    const rows = toTaskFields(taskFormSchema.parse({ ...valid, childIds: ['c1', 'c2'] }), true);
    expect(rows.map((r) => r.child_id)).toEqual(['c1', 'c2']);
    expect(rows[0]).toMatchObject({ points: 25, start_time: '08:00', end_time: '08:45', note: null });
  });
  it('enfant : points imposés à 10', () => {
    expect(toTaskFields(taskFormSchema.parse(valid), false)[0]?.points).toBe(DEFAULT_POINTS);
  });
  it('échéance → end_time seul ; sans heure → aucun horaire', () => {
    const deadline = taskFormSchema.parse({ ...valid, timeKind: 'deadline', startTime: '08:00', endTime: '21:00' });
    expect(toTaskFields(deadline, true)[0]).toMatchObject({ start_time: null, end_time: '21:00' });
    const anytime = taskFormSchema.parse({ ...valid, timeKind: 'anytime', startTime: '08:00', endTime: '09:00' });
    expect(toTaskFields(anytime, true)[0]).toMatchObject({ start_time: null, end_time: null });
  });
  it('conserve la note rognée', () => {
    expect(toTaskFields(taskFormSchema.parse({ ...valid, note: '  hello ' }), true)[0]?.note).toBe('hello');
  });
});

import {
  childWeeklyInputs, dueByDay, dueMarkedDays, isLate, lastVisibleDay, parentWeeklyInputs, shouldCollapse, sortWeekly, visibleWeekly, weeklyItem,
  type ChildWeeklyRow, type ParentWeeklyRow, type WeeklyInput,
} from './weekly-quiz';

const base = (o: Partial<WeeklyInput> = {}): WeeklyInput => ({
  quizId: 'q1', subject: 'maths', title: 'Phân số', weekLabel: 'Tuần 1', releaseOn: '2026-10-19', dueOn: '2026-10-25', attemptId: null, attemptStatus: null,
  answered: 0, questionCount: 16, score: null, scoreTotal: null, ...o,
});

describe('fenêtre d’affichage', () => {
  it('dernier jour = dimanche de la semaine qui suit la date limite', () => {
    expect(lastVisibleDay('2026-10-19', '2026-10-25')).toBe('2026-11-01');
    expect(lastVisibleDay('2026-10-19', '2026-10-22')).toBe('2026-11-01');
    expect(lastVisibleDay('2026-10-19', '2026-12-31')).toBe('2027-01-10');
  });
  it('sans date limite : repli sur l’ouverture ; sans rien : null', () => {
    expect(lastVisibleDay('2026-10-19', null)).toBe('2026-11-01');
    expect(lastVisibleDay(null, null)).toBeNull();
  });
  it('pas affiché avant l’ouverture, affiché dès le jour d’ouverture', () => {
    expect(weeklyItem(base(), '2026-10-18')).toBeNull();
    expect(weeklyItem(base(), '2026-10-19')).not.toBeNull();
    expect(weeklyItem(base({ releaseOn: null }), '2026-10-19')).toBeNull();
  });
  it('affiché jusqu’à la date limite, puis « en retard » jusqu’à la fin de la semaine suivante, puis disparaît', () => {
    expect(weeklyItem(base(), '2026-10-25')?.late).toBe(false);
    const late = weeklyItem(base(), '2026-10-26');
    expect(late?.late).toBe(true);
    expect(late?.state).toBe('todo');
    expect(weeklyItem(base(), '2026-11-01')?.late).toBe(true);
    expect(weeklyItem(base(), '2026-11-02')).toBeNull();
  });
  it('un quiz envoyé reste affiché tant que le parent n’a pas validé, même après la fenêtre', () => {
    expect(weeklyItem(base({ attemptStatus: 'submitted', attemptId: 'a1' }), '2026-12-01')?.state).toBe('waiting');
  });
  it('un quiz validé suit la fenêtre commune', () => {
    const v = base({ attemptStatus: 'validated', attemptId: 'a1', score: 12, scoreTotal: 16 });
    expect(weeklyItem(v, '2026-11-01')?.state).toBe('validated');
    expect(weeklyItem(v, '2026-11-02')).toBeNull();
  });
  it('la date est un jour local : la comparaison est lexicographique sur YYYY-MM-DD (changement de mois et d’année)', () => {
    const i = base({ releaseOn: '2026-12-28', dueOn: '2027-01-03' });
    expect(weeklyItem(i, '2027-01-03')?.late).toBe(false);
    expect(weeklyItem(i, '2027-01-04')?.late).toBe(true);
    expect(weeklyItem(i, '2027-01-10')?.late).toBe(true);
    expect(weeklyItem(i, '2027-01-11')).toBeNull();
  });
});

describe('états', () => {
  it('à faire', () => {
    const w = weeklyItem(base(), '2026-10-20');
    expect(w).toMatchObject({ state: 'todo', late: false, progress: null, result: null });
  });
  it('en cours : progression bornée au nombre de questions', () => {
    expect(weeklyItem(base({ attemptStatus: 'in_progress', attemptId: 'a1', answered: 6 }), '2026-10-20')).toMatchObject({ state: 'in_progress', progress: { answered: 6, total: 16 } });
    expect(weeklyItem(base({ attemptStatus: 'in_progress', answered: 40 }), '2026-10-20')?.progress).toEqual({ answered: 16, total: 16 });
    expect(weeklyItem(base({ attemptStatus: 'in_progress', answered: -3 }), '2026-10-20')?.progress).toEqual({ answered: 0, total: 16 });
  });
  it('en cours et en retard : les deux informations', () => {
    expect(weeklyItem(base({ attemptStatus: 'in_progress', answered: 6 }), '2026-10-27')).toMatchObject({ state: 'in_progress', late: true, progress: { answered: 6, total: 16 } });
  });
  it('en attente de validation : jamais « en retard », ni score', () => {
    expect(weeklyItem(base({ attemptStatus: 'submitted', attemptId: 'a1', score: 12, scoreTotal: 16 }), '2026-10-28')).toMatchObject({ state: 'waiting', late: false, result: null, progress: null });
  });
  it('validé : score affiché ; sans score reçu, pas de résultat', () => {
    expect(weeklyItem(base({ attemptStatus: 'validated', score: 12, scoreTotal: 16 }), '2026-10-28')).toMatchObject({ state: 'validated', late: false, result: { score: 12, total: 16 } });
    expect(weeklyItem(base({ attemptStatus: 'validated' }), '2026-10-28')?.result).toBeNull();
  });
  it('isLate : seulement à faire / en cours, strictement après la date limite', () => {
    expect(isLate('2026-10-25', '2026-10-25', 'todo')).toBe(false);
    expect(isLate('2026-10-25', '2026-10-26', 'todo')).toBe(true);
    expect(isLate('2026-10-25', '2026-10-26', 'waiting')).toBe(false);
    expect(isLate('2026-10-25', '2026-10-26', 'validated')).toBe(false);
    expect(isLate(null, '2026-10-26', 'todo')).toBe(false);
  });
});

describe('calendrier : sans fenêtre d’affichage', () => {
  it('un quiz clos reste repérable sur sa date limite', () => {
    expect(weeklyItem(base(), '2026-12-01')).toBeNull();
    expect(weeklyItem(base(), '2026-12-01', false)?.dueOn).toBe('2026-10-25');
    expect(visibleWeekly([base()], '2026-12-01', false)).toHaveLength(1);
    expect(weeklyItem(base(), '2026-10-01', false)).toBeNull();
  });
});

describe('plusieurs matières', () => {
  const list = [
    base({ quizId: 'v', subject: 'hist_geo', title: 'B', attemptStatus: 'validated', score: 9, scoreTotal: 16 }),
    base({ quizId: 'w', subject: 'anglais', title: 'C', attemptStatus: 'submitted' }),
    base({ quizId: 't2', subject: 'maths', title: 'A', dueOn: '2026-10-25' }),
    base({ quizId: 't1', subject: 'francais', title: 'A', dueOn: '2026-10-22' }),
    base({ quizId: 'p', subject: 'sciences', title: 'D', attemptStatus: 'in_progress', answered: 2 }),
    base({ quizId: 'x', releaseOn: '2026-11-30', dueOn: '2026-12-06' }),
  ];
  it('ordre : en cours, à faire (échéance proche d’abord), envoyé, validé ; ne garde que les lignes ouvertes', () => {
    expect(visibleWeekly(list, '2026-10-20').map((x) => x.quizId)).toEqual(['p', 't1', 't2', 'w', 'v']);
  });
  it('à état et échéance égaux : matière, puis titre, puis identifiant', () => {
    const a = weeklyItem(base({ quizId: 'b', subject: 'maths', title: 'Z' }), '2026-10-20');
    const b = weeklyItem(base({ quizId: 'a', subject: 'maths', title: 'Z' }), '2026-10-20');
    const c = weeklyItem(base({ quizId: 'c', subject: 'anglais', title: 'Z' }), '2026-10-20');
    const d = weeklyItem(base({ quizId: 'd', subject: 'anglais', title: 'A' }), '2026-10-20');
    expect(sortWeekly([a, b, c, d].filter((x) => x !== null)).map((x) => x.quizId)).toEqual(['d', 'c', 'a', 'b']);
  });
  it('sans date limite : classé après ceux qui en ont', () => {
    const nodue = weeklyItem(base({ quizId: 'n', dueOn: null }), '2026-10-20');
    const due = weeklyItem(base({ quizId: 'd' }), '2026-10-20');
    expect(sortWeekly([nodue, due].filter((x) => x !== null)).map((x) => x.quizId)).toEqual(['d', 'n']);
  });
  it('repli : plus d’une ligne → groupe « Révisions (n) »', () => {
    expect(shouldCollapse(0)).toBe(false);
    expect(shouldCollapse(1)).toBe(false);
    expect(shouldCollapse(2)).toBe(true);
    expect(shouldCollapse(5)).toBe(true);
  });
});

describe('adaptateurs', () => {
  const child = (o: Partial<ChildWeeklyRow> = {}): ChildWeeklyRow => ({
    source: 'catalog', set_id: 'q1', subject_key: 'maths', title: 'T', week_label: 'Tuần 1', question_count: 16, evaluation_attempt_id: 'a1', evaluation_status: 'in_progress',
    due_on: '2026-10-25', release_on: '2026-10-19', answered_count: 6, score: null, total: null, ...o,
  });
  it('enfant : seulement le catalogue, champs reportés', () => {
    const out = childWeeklyInputs([child(), child({ source: 'family', set_id: 'f1' })]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ quizId: 'q1', subject: 'maths', releaseOn: '2026-10-19', dueOn: '2026-10-25', attemptId: 'a1', attemptStatus: 'in_progress', answered: 6, questionCount: 16 });
  });
  it('enfant : matière ou semaine absentes → chaînes vides', () => {
    expect(childWeeklyInputs([child({ subject_key: null, week_label: null })])[0]).toMatchObject({ subject: '', weekLabel: '' });
  });
  const parent = (o: Partial<ParentWeeklyRow> = {}): ParentWeeklyRow => ({
    quiz_id: 'q1', subject: 'maths', week_label: 'Tuần 1', title: 'T', question_count: 16, release_on: '2026-10-19', due_on: '2026-10-25', available: true, attempt_id: 'a1',
    attempt_status: 'submitted', answered_count: 0, score: 12, total: 16, ...o,
  });
  it('parent : seulement les quiz ouverts', () => {
    const out = parentWeeklyInputs([parent(), parent({ quiz_id: 'q2', available: false })]);
    expect(out.map((x) => x.quizId)).toEqual(['q1']);
    expect(out[0]).toMatchObject({ attemptId: 'a1', attemptStatus: 'submitted', score: 12, scoreTotal: 16 });
  });
  it('parent : un quiz envoyé n’expose pas son score avant validation', () => {
    expect(weeklyItem(parentWeeklyInputs([parent()])[0] as WeeklyInput, '2026-10-22')?.result).toBeNull();
  });
});

describe('calendrier', () => {
  const days = ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25'];
  it('regroupe par jour de date limite ; ignore hors semaine et sans date', () => {
    const items = [{ id: 1, dueOn: '2026-10-25' }, { id: 2, dueOn: '2026-10-25' }, { id: 3, dueOn: '2026-10-22' }, { id: 4, dueOn: '2026-11-01' }, { id: 5, dueOn: null }];
    const by = dueByDay(items, days);
    expect(by['2026-10-25']?.map((x) => x.id)).toEqual([1, 2]);
    expect(by['2026-10-22']?.map((x) => x.id)).toEqual([3]);
    expect(by['2026-10-19']).toEqual([]);
    expect([...dueMarkedDays(by)].sort()).toEqual(['2026-10-22', '2026-10-25']);
  });
  it('aucune date limite : aucun repère', () => {
    expect(dueMarkedDays(dueByDay([], days)).size).toBe(0);
  });
});

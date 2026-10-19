import { choiceMarks, detailState, detailSummary, isForbidden, needsCheck, questionNumber } from './quiz-detail';

describe('detailState', () => {
  it('quatre états : pas commencé, en cours, à valider, validé', () => {
    expect(detailState(null)).toBe('todo');
    expect(detailState(undefined)).toBe('todo');
    expect(detailState('in_progress')).toBe('in_progress');
    expect(detailState('submitted')).toBe('waiting');
    expect(detailState('validated')).toBe('validated');
  });
});

describe('needsCheck (badge « cần kiểm tra », parent seulement)', () => {
  it('réponse signalée non confirmée : oui, pour tous les types', () => {
    for (const kind of ['exam', 'exam_key', 'course', 'list'] as const) expect(needsCheck({ to_verify: true, confirmed: false }, kind)).toBe(true);
  });
  it('signalée mais confirmée : non', () => {
    expect(needsCheck({ to_verify: true, confirmed: true }, 'exam')).toBe(false);
  });
  it('examen non confirmé : oui ; cours / liste non signalés : non', () => {
    expect(needsCheck({ to_verify: false, confirmed: false }, 'exam')).toBe(true);
    expect(needsCheck({ to_verify: false, confirmed: false }, 'exam_key')).toBe(true);
    expect(needsCheck({ to_verify: false, confirmed: false }, 'course')).toBe(false);
    expect(needsCheck({ to_verify: false, confirmed: false }, 'list')).toBe(false);
    expect(needsCheck({ to_verify: false, confirmed: true }, 'exam')).toBe(false);
  });
});

describe('choiceMarks : indices d’ORIGINE des deux côtés', () => {
  const q = { choices: ['a', 'b', 'c', 'd'], correct_index: 2, choice_index: 0 };
  it('marque la bonne réponse et le choix FAUX de l’enfant', () => {
    expect(choiceMarks(q, true)).toEqual([
      { index: 0, letter: 'A', text: 'a', correct: false, chosen: true, wrong: true },
      { index: 1, letter: 'B', text: 'b', correct: false, chosen: false, wrong: false },
      { index: 2, letter: 'C', text: 'c', correct: true, chosen: false, wrong: false },
      { index: 3, letter: 'D', text: 'd', correct: false, chosen: false, wrong: false },
    ]);
  });
  it('bonne réponse choisie : marquée juste, jamais fausse', () => {
    const marks = choiceMarks({ ...q, choice_index: 2 }, true);
    expect(marks[2]).toMatchObject({ correct: true, chosen: true, wrong: false });
    expect(marks.filter((m) => m.wrong)).toEqual([]);
  });
  it('pas de réponse : aucun choix marqué ; quiz pas commencé : aucune marque d’enfant', () => {
    expect(choiceMarks({ ...q, choice_index: null }, true).some((m) => m.chosen)).toBe(false);
    expect(choiceMarks(q, false).some((m) => m.chosen || m.wrong)).toBe(false);
    expect(choiceMarks(q, false)[2]?.correct).toBe(true); // la clé reste visible du parent
  });
  it('un indice hors des choix ne marque rien (jamais d’exception)', () => {
    expect(choiceMarks({ ...q, choice_index: 9 }, true).some((m) => m.chosen)).toBe(false);
  });
});

describe('questionNumber', () => {
  it('numéro d’origine, sinon rang', () => {
    expect(questionNumber({ number: 12, position: 0 })).toBe(12);
    expect(questionNumber({ number: null, position: 0 })).toBe(1);
  });
});

describe('detailSummary', () => {
  it('pas de tentative', () => {
    expect(detailSummary(null, 5)).toEqual({ state: 'todo', answered: 0, total: 5, score: null, scoreTotal: null, points: null });
  });
  it('en cours : đã trả lời N/total, ni score ni points', () => {
    expect(detailSummary({ status: 'in_progress', answered: 3, score: null, total: null, points_awarded: null }, 5)).toEqual({ state: 'in_progress', answered: 3, total: 5, score: null, scoreTotal: null, points: null });
  });
  it('à valider : score connu, pas encore de points', () => {
    expect(detailSummary({ status: 'submitted', answered: 5, score: 4, total: 5, points_awarded: null }, 5)).toMatchObject({ state: 'waiting', score: 4, scoreTotal: 5, points: null });
  });
  it('validé : score et points (0 possible)', () => {
    expect(detailSummary({ status: 'validated', answered: 5, score: 5, total: 5, points_awarded: 8 }, 5)).toMatchObject({ state: 'validated', score: 5, scoreTotal: 5, points: 8 });
    expect(detailSummary({ status: 'validated', answered: 5, score: 1, total: 5, points_awarded: null }, 5).points).toBe(0);
  });
});

describe('isForbidden', () => {
  it('reconnaît le refus du serveur', () => {
    expect(isForbidden({ code: '42501', message: 'x' })).toBe(true);
    expect(isForbidden({ message: 'forbidden' })).toBe(true);
    expect(isForbidden({ code: 'PGRST202' })).toBe(false);
    expect(isForbidden(null)).toBe(false);
  });
});

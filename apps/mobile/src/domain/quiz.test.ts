import {
  answersPayload, canPublish, evaluationView, historySeries, lastChange, moveItem, nextPosition, normalizeQuestion, originalIndex, scoreAnswers, scorePercent,
  quizErrorKey, shuffleChoices, shuffledOrder, unansweredCount, validateQuestion, validateSetTitle, type QuestionDraft,
} from './quiz';

const ok: QuestionDraft = { prompt: 'Combien font 2 + 2 ?', choices: ['3', '4', '5', ''], correctIndex: 1, explanation: '' };

describe('validateQuestion', () => {
  it('une question valide (3 choix + champ vide ignoré)', () => expect(validateQuestion(ok)).toEqual([]));
  it('énoncé vide ou trop long', () => {
    expect(validateQuestion({ ...ok, prompt: '   ' })).toContain('promptRequired');
    expect(validateQuestion({ ...ok, prompt: 'x'.repeat(501) })).toContain('promptTooLong');
    expect(validateQuestion({ ...ok, prompt: 'x'.repeat(500) })).toEqual([]);
  });
  it('3 à 4 choix non vides', () => {
    expect(validateQuestion({ ...ok, choices: ['3', '4', '', ''] })).toContain('choicesCount');
    expect(validateQuestion({ ...ok, choices: ['3', '4', '5', '6'] })).toEqual([]);
    expect(validateQuestion({ ...ok, choices: ['3', '4', '5', '6', '7'] })).toContain('choicesCount');
  });
  it('choix trop long, doublons (casse et espaces ignorés)', () => {
    expect(validateQuestion({ ...ok, choices: ['a', 'b', 'c'.repeat(201)] })).toContain('choiceTooLong');
    expect(validateQuestion({ ...ok, choices: ['Paris', ' paris ', 'Rome'], correctIndex: 0 })).toContain('duplicateChoices');
  });
  it('bonne réponse : obligatoire et sur un choix non vide', () => {
    expect(validateQuestion({ ...ok, correctIndex: null })).toContain('correctRequired');
    expect(validateQuestion({ ...ok, correctIndex: 3 })).toContain('correctEmpty'); // le 4e champ est vide
    expect(validateQuestion({ ...ok, correctIndex: 9 })).toContain('correctEmpty');
  });
  it('explication bornée', () => {
    expect(validateQuestion({ ...ok, explanation: 'e'.repeat(501) })).toContain('explanationTooLong');
    expect(validateQuestion({ ...ok, explanation: 'e'.repeat(500) })).toEqual([]);
  });
  it('plusieurs erreurs à la fois', () => {
    expect(validateQuestion({ prompt: '', choices: ['a', 'a', ''], correctIndex: null, explanation: '' })).toEqual(['promptRequired', 'choicesCount', 'duplicateChoices', 'correctRequired']);
  });
});

describe('normalizeQuestion', () => {
  it('retire les champs vides et recale la bonne réponse', () => {
    expect(normalizeQuestion({ prompt: '  Q  ', choices: ['', 'a', 'b', 'c'], correctIndex: 2, explanation: ' parce que ' })).toEqual({ prompt: 'Q', choices: ['a', 'b', 'c'], correct: 1, explanation: 'parce que' });
  });
  it('explication vide → null ; invalide → null', () => {
    expect(normalizeQuestion(ok)?.explanation).toBeNull();
    expect(normalizeQuestion({ ...ok, prompt: '' })).toBeNull();
  });
});

describe('validateSetTitle / canPublish', () => {
  it('titre et matière', () => {
    expect(validateSetTitle('Fractions', 'Toán')).toEqual([]);
    expect(validateSetTitle(' ', '')).toEqual(['titleRequired']);
    expect(validateSetTitle('t'.repeat(81), '')).toEqual(['titleTooLong']);
    expect(validateSetTitle('t', 's'.repeat(41))).toEqual(['subjectTooLong']);
  });
  it('publication : au moins une question', () => {
    expect(canPublish(0)).toBe(false);
    expect(canPublish(1)).toBe(true);
  });
});

describe('score', () => {
  it('compte les bonnes réponses, sans réponse = faux', () => {
    expect(scoreAnswers([1, 0, 2], [1, 2, null])).toEqual({ score: 1, total: 3 });
    expect(scoreAnswers([1, 0, 2], [1, 0, 2])).toEqual({ score: 3, total: 3 });
    expect(scoreAnswers([1, 0, 2], [])).toEqual({ score: 0, total: 3 });
    expect(scoreAnswers([], [])).toEqual({ score: 0, total: 0 });
  });
  it('pourcentage arrondi, 0 sans question', () => {
    expect(scorePercent(2, 3)).toBe(67);
    expect(scorePercent(1, 3)).toBe(33);
    expect(scorePercent(0, 0)).toBe(0);
    expect(scorePercent(5, 5)).toBe(100);
  });
});

describe('mélange des choix', () => {
  it('permutation valide, stable pour une même graine', () => {
    const o = shuffledOrder(4, 'att1:q1');
    expect([...o].sort()).toEqual([0, 1, 2, 3]);
    expect(shuffledOrder(4, 'att1:q1')).toEqual(o);
  });
  it('graines différentes → ordres variés (au moins un diffère sur 20 graines)', () => {
    const seen = new Set(Array.from({ length: 20 }, (_, i) => shuffledOrder(4, `seed${i}`).join('')));
    expect(seen.size).toBeGreaterThan(3);
  });
  it('shuffleChoices : mêmes choix, indice d\'origine retrouvé', () => {
    const base = ['a', 'b', 'c', 'd'];
    const { choices, order } = shuffleChoices(base, 'x');
    expect([...choices].sort()).toEqual(base);
    choices.forEach((c, displayed) => expect(base[originalIndex(order, displayed)]).toBe(c));
  });
  it('0 et 1 choix ne plantent pas', () => {
    expect(shuffledOrder(0, 's')).toEqual([]);
    expect(shuffledOrder(1, 's')).toEqual([0]);
  });
});

describe('liste de questions', () => {
  it('moveItem', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(moveItem(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
    expect(moveItem(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'b', 'c']);
    expect(moveItem(['a', 'b', 'c'], -1, 1)).toEqual(['a', 'b', 'c']);
    expect(moveItem(['a', 'b', 'c'], 0, 3)).toEqual(['a', 'b', 'c']);
  });
  it('nextPosition', () => {
    expect(nextPosition([])).toBe(0);
    expect(nextPosition([0, 1, 4])).toBe(5);
  });
});

describe('envoi de l\'évaluation', () => {
  const qs = [{ question_id: 'q1', choices: ['a', 'b', 'c'] }, { question_id: 'q2', choices: ['a', 'b', 'c'] }];
  it('charge utile : indices d\'origine, null si sans réponse', () => {
    expect(answersPayload(qs, { q1: 2 })).toEqual([{ question_id: 'q1', choice: 2 }, { question_id: 'q2', choice: null }]);
    expect(answersPayload(qs, { q1: 0, q2: 0 })).toEqual([{ question_id: 'q1', choice: 0 }, { question_id: 'q2', choice: 0 }]);
  });
  it('questions sans réponse', () => {
    expect(unansweredCount(qs, { q1: 0 })).toBe(1);
    expect(unansweredCount(qs, { q1: 0, q2: 0 })).toBe(0);
    expect(unansweredCount(qs, {})).toBe(2);
  });
});

describe('états et progression', () => {
  it('evaluationView', () => {
    expect(evaluationView(null)).toBe('todo');
    expect(evaluationView(undefined)).toBe('todo');
    expect(evaluationView('in_progress')).toBe('in_progress');
    expect(evaluationView('submitted')).toBe('waiting');
    expect(evaluationView('validated')).toBe('validated');
  });
  const entries = [
    { id: 'b', at: '2026-07-03T10:00:00Z', kind: 'evaluation' as const, score: 4, total: 5 },
    { id: 'a', at: '2026-07-01T10:00:00Z', kind: 'evaluation' as const, score: 2, total: 5 },
    { id: 'c', at: '2026-07-02T10:00:00Z', kind: 'practice' as const, score: 3, total: 5 },
    { id: 'd', at: '2026-07-03T10:00:00Z', kind: 'practice' as const, score: 5, total: 5 },
  ];
  it('historique : chronologique, pourcentages, filtre par type', () => {
    expect(historySeries(entries).map((p) => p.id)).toEqual(['a', 'c', 'b', 'd']);
    expect(historySeries(entries, 'evaluation').map((p) => p.percent)).toEqual([40, 80]);
    expect(historySeries([])).toEqual([]);
  });
  it('lastChange : écart entre les deux derniers résultats', () => {
    expect(lastChange(historySeries(entries, 'evaluation'))).toBe(40);
    expect(lastChange(historySeries(entries.slice(0, 1)))).toBeNull();
    expect(lastChange([])).toBeNull();
  });
});

describe('quizErrorKey', () => {
  it('codes connus et repli générique', () => {
    expect(quizErrorKey('no_questions')).toBe('revisions.server.noQuestions');
    expect(quizErrorKey('evaluation_already_taken')).toBe('revisions.server.evaluationTaken');
    expect(quizErrorKey('boom')).toBe('common.error');
    expect(quizErrorKey('')).toBe('common.error');
  });
});

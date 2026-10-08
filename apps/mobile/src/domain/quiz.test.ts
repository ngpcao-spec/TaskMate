import {
  gridOrder, isExamSet, letterOf, LETTERS, publishBlockers,
  answersPayload, canPublish, evaluationView, historySeries, lastChange, moveItem, nextPosition, normalizeQuestion, scoreAnswers, scorePercent,
  answeredCount, PAPER_MODES, paperFlags, paperModeOf, questionTag,
  quizErrorKey, unansweredCount, validateQuestion, validateSetTitle, type QuestionDraft,
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
  it('charge utile : positions affichées, null si sans réponse', () => {
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
    { id: 'b', at: '2026-07-03T10:00:00Z', score: 4, total: 5 },
    { id: 'a', at: '2026-07-01T10:00:00Z', score: 2, total: 5 },
  ];
  it('historique : chronologique, pourcentages', () => {
    expect(historySeries(entries).map((p) => p.id)).toEqual(['a', 'b']);
    expect(historySeries(entries).map((p) => p.percent)).toEqual([40, 80]);
    expect(historySeries([])).toEqual([]);
  });
  it('lastChange : écart entre les deux derniers résultats', () => {
    expect(lastChange(historySeries(entries))).toBe(40);
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

describe('supports multiples : grille Đáp án et règle de publication', () => {
  const q = (id: string, position: number, origin_number: number | null) => ({ id, position, origin_number });
  it('lettres A à D', () => {
    expect([...LETTERS]).toEqual(['A', 'B', 'C', 'D']);
    expect(letterOf(0)).toBe('A');
    expect(letterOf(3)).toBe('D');
    expect(letterOf(4)).toBe('?');
  });
  it('gridOrder : par numéro d\'origine, les questions sans numéro à la suite dans l\'ordre de saisie', () => {
    const order = gridOrder([q('c', 2, 7), q('a', 0, 5), q('x', 5, null), q('b', 1, 6), q('y', 3, null)]);
    expect(order.map((o) => o.id)).toEqual(['a', 'b', 'c', 'y', 'x']);
  });
  it('gridOrder : numéros égaux → ordre de saisie ; ne modifie pas l\'entrée', () => {
    const input = [q('b', 1, 5), q('a', 0, 5)];
    expect(gridOrder(input).map((o) => o.id)).toEqual(['a', 'b']);
    expect(input.map((o) => o.id)).toEqual(['b', 'a']);
    expect(gridOrder([q('z', 1, null), q('y', 1, null)]).map((o) => o.id)).toEqual(['y', 'z']); // même position : identifiant
  });
  it('types examen', () => {
    expect(isExamSet('exam')).toBe(true);
    expect(isExamSet('exam_key')).toBe(true);
    expect(isExamSet('course')).toBe(false);
    expect(isExamSet('list')).toBe(false);
  });
  it('publishBlockers : « à vérifier » bloque TOUS les types ; examen : réponses non confirmées bloquent aussi', () => {
    const open = { to_verify: true, confirmed: false };
    const plain = { to_verify: false, confirmed: false };
    const done = { to_verify: false, confirmed: true };
    expect(publishBlockers('exam', [done, done])).toEqual({ toVerify: 0, unconfirmed: 0, blocked: false });
    expect(publishBlockers('exam', [done, plain])).toEqual({ toVerify: 0, unconfirmed: 1, blocked: true });
    expect(publishBlockers('exam_key', [open, plain, done])).toEqual({ toVerify: 1, unconfirmed: 2, blocked: true });
    expect(publishBlockers('course', [plain, plain])).toEqual({ toVerify: 0, unconfirmed: 0, blocked: false }); // comportement actuel
    expect(publishBlockers('course', [open])).toEqual({ toVerify: 1, unconfirmed: 0, blocked: true }); // un type « cours » n'affaiblit pas le contrôle
    expect(publishBlockers('list', [])).toEqual({ toVerify: 0, unconfirmed: 0, blocked: false });
  });
  it('messages d\'erreur de publication', () => {
    expect(quizErrorKey('answers_to_verify')).toBe('revisions.server.answersToVerify');
    expect(quizErrorKey('answers_not_confirmed')).toBe('revisions.server.answersNotConfirmed');
    expect(quizErrorKey('invalid_number')).toBe('revisions.errors.promptRequired');
  });
});

describe('support papier (D-062)', () => {
  it('mode de réponse depuis les réglages du jeu', () => {
    expect(paperModeOf({ paper_support: false, answer_sheet_only: false })).toBe('screen');
    expect(paperModeOf({ paper_support: true, answer_sheet_only: false })).toBe('paper');
    expect(paperModeOf({ paper_support: true, answer_sheet_only: true })).toBe('sheet');
  });
  it('réglages envoyés au serveur : « feuille seule » implique le papier, aller-retour cohérent', () => {
    expect(paperFlags('screen')).toEqual({ paper: false, sheetOnly: false });
    expect(paperFlags('paper')).toEqual({ paper: true, sheetOnly: false });
    expect(paperFlags('sheet')).toEqual({ paper: true, sheetOnly: true });
    for (const m of PAPER_MODES) expect(paperModeOf({ paper_support: paperFlags(m).paper, answer_sheet_only: paperFlags(m).sheetOnly })).toBe(m);
  });
  it('numéro affiché : celui de la feuille, sinon « #rang » (jamais un nombre nu)', () => {
    expect(questionTag(12, 0)).toBe('12');
    expect(questionTag(null, 2)).toBe('#3');
    expect(questionTag(undefined, 0)).toBe('#1');
  });
  it('progression de la feuille', () => {
    const qs = [{ question_id: 'a', choices: ['A', 'B'] }, { question_id: 'b', choices: ['A', 'B'] }];
    expect(answeredCount(qs, {})).toBe(0);
    expect(answeredCount(qs, { a: 0, b: null })).toBe(1);
    expect(answeredCount(qs, { a: 0, b: 1 })).toBe(2);
  });
});

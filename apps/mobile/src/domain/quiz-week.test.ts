import { formatDueDay } from './calendar';
import { defaultDueOn, isPastDue, quizWeekStatus, restoredAnswers } from './quiz-week';
import { todayInTz } from './family-time';

describe('date limite par défaut : le dimanche suivant', () => {
  it('un lundi → le dimanche de la même semaine', () => expect(defaultDueOn('2026-10-19')).toBe('2026-10-25'));
  it('un mercredi, un samedi → le dimanche de la même semaine', () => {
    expect(defaultDueOn('2026-10-14')).toBe('2026-10-18');
    expect(defaultDueOn('2026-10-24')).toBe('2026-10-25');
  });
  it('un dimanche → le dimanche d’après (jamais « aujourd’hui »)', () => expect(defaultDueOn('2026-10-18')).toBe('2026-10-25'));
  it('passe un changement de mois et d’année', () => {
    expect(defaultDueOn('2026-10-29')).toBe('2026-11-01');
    expect(defaultDueOn('2026-12-30')).toBe('2027-01-03');
  });
  it('la date proposée est bien un dimanche', () => {
    for (const d of ['2026-10-12', '2026-10-13', '2026-10-17', '2026-10-18', '2026-02-28']) expect(formatDueDay(defaultDueOn(d), 'en')).toMatch(/^Sunday /);
  });
});

describe('retard (information seulement)', () => {
  it('le jour de la date limite le quiz est encore dans les temps ; le lendemain il est en retard', () => {
    expect(isPastDue('2026-10-25', '2026-10-25')).toBe(false);
    expect(isPastDue('2026-10-25', '2026-10-26')).toBe(true);
    expect(isPastDue('2026-10-25', '2026-10-20')).toBe(false);
  });
  it('sans date limite : jamais en retard', () => {
    expect(isPastDue(null, '2030-01-01')).toBe(false);
    expect(isPastDue(undefined, '2030-01-01')).toBe(false);
  });
  it('le jour est celui de la FAMILLE, pas celui de l’UTC : 23 h 30 UTC = déjà lendemain à Hô-Chi-Minh', () => {
    const now = new Date('2026-10-25T17:30:00Z'); // 00:30 le 26 à Hô-Chi-Minh, 17:30 le 25 en UTC
    expect(todayInTz(now, 'Asia/Ho_Chi_Minh')).toBe('2026-10-26');
    expect(isPastDue('2026-10-25', todayInTz(now, 'Asia/Ho_Chi_Minh'))).toBe(true);
    expect(isPastDue('2026-10-25', todayInTz(now, 'UTC'))).toBe(false);
  });
});

describe('statut du quiz pour le parent', () => {
  const base = { dueOn: '2026-10-25', today: '2026-10-22', total: 20 };
  it('pas commencé / en cours (n sur N)', () => {
    expect(quizWeekStatus({ ...base, attemptStatus: null, answered: 0 })).toEqual({ state: 'not_started', late: false, progress: null });
    expect(quizWeekStatus({ ...base, attemptStatus: 'in_progress', answered: 12 })).toEqual({ state: 'in_progress', late: false, progress: { answered: 12, total: 20 } });
  });
  it('envoyé / validé : jamais « en retard », même après la date limite', () => {
    const late = { ...base, today: '2026-11-30' };
    expect(quizWeekStatus({ ...late, attemptStatus: 'submitted', answered: 0 })).toEqual({ state: 'submitted', late: false, progress: null });
    expect(quizWeekStatus({ ...late, attemptStatus: 'validated', answered: 0 })).toEqual({ state: 'validated', late: false, progress: null });
  });
  it('en retard : date passée et pas encore envoyé (pas commencé OU en cours, avec sa progression)', () => {
    const late = { ...base, today: '2026-10-26' };
    expect(quizWeekStatus({ ...late, attemptStatus: null, answered: 0 })).toEqual({ state: 'late', late: true, progress: null });
    expect(quizWeekStatus({ ...late, attemptStatus: 'in_progress', answered: 7 })).toEqual({ state: 'late', late: true, progress: { answered: 7, total: 20 } });
  });
  it('sans date limite : jamais en retard', () => {
    expect(quizWeekStatus({ dueOn: null, today: '2031-01-01', total: 5, attemptStatus: 'in_progress', answered: 1 }).late).toBe(false);
  });
  it('le nombre de réponses reste entre 0 et le total', () => {
    expect(quizWeekStatus({ ...base, attemptStatus: 'in_progress', answered: 99 }).progress).toEqual({ answered: 20, total: 20 });
    expect(quizWeekStatus({ ...base, attemptStatus: 'in_progress', answered: -3 }).progress).toEqual({ answered: 0, total: 20 });
  });
});

describe('reprise : réponses enregistrées → état de l’écran', () => {
  const qs = [
    { question_id: 'q1', choices: ['a', 'b', 'c'] },
    { question_id: 'q2', choices: ['a', 'b', 'c', 'd'] },
  ];
  it('restitue les positions affichées', () => {
    expect(restoredAnswers(qs, [{ question_id: 'q1', choice: 2 }, { question_id: 'q2', choice: 0 }])).toEqual({ q1: 2, q2: 0 });
  });
  it('ignore une question inconnue ou une position hors choix (jamais d’erreur)', () => {
    expect(restoredAnswers(qs, [{ question_id: 'zz', choice: 0 }, { question_id: 'q1', choice: 3 }, { question_id: 'q2', choice: -1 }, { question_id: 'q2', choice: 1.5 }])).toEqual({});
  });
  it('aucune réponse enregistrée : état vide', () => expect(restoredAnswers(qs, [])).toEqual({}));
});

describe('libellé de la date limite', () => {
  it('« dimanche 26/10 » (jour de la semaine déduit de la date, dans la langue)', () => {
    expect(formatDueDay('2026-10-25', 'fr')).toBe('dimanche 25/10');
    expect(formatDueDay('2026-10-25', 'en')).toBe('Sunday 25/10');
    expect(formatDueDay('2026-10-25', 'vi')).toMatch(/25\/10$/);
  });
});

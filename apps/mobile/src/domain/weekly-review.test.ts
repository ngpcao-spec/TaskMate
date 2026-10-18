import {
  bannerModel, daysUntil, isUnfinished, itemWeek, nearestDue, sortCards, URGENT_DAYS, weekBounds, weekHeader, weekItems, weekNumber, weekStats,
} from './weekly-review';
import type { WeeklyItem, WeeklyState } from './weekly-quiz';

// Semaine courante : lundi 19/10/2026 → dimanche 25/10/2026 (fuseau Asia/Ho_Chi_Minh).
let n = 0;
const item = (state: WeeklyState, over: Partial<WeeklyItem> = {}): WeeklyItem => ({
  quizId: `q${++n}`, subject: 'maths', title: 'T', weekLabel: 'Tuần 8', releaseOn: '2026-10-19', dueOn: '2026-10-23', attemptId: null, state, late: false,
  progress: null, result: null, maxPoints: 8, pointsAwarded: 0, ...over,
});
const TODAY = '2026-10-21';

describe('semaine d’un quiz (lundi → dimanche, jour local)', () => {
  it('rattaché à l’échéance ; repli sur l’ouverture ; sinon aucune', () => {
    expect(itemWeek({ dueOn: '2026-10-23', releaseOn: '2026-10-01' })).toBe('2026-10-19');
    expect(itemWeek({ dueOn: null, releaseOn: '2026-10-21' })).toBe('2026-10-19');
    expect(itemWeek({ dueOn: null, releaseOn: null })).toBeNull();
  });
  it('frontières : lundi → même semaine ; dimanche → même semaine ; lundi suivant → semaine suivante', () => {
    expect(itemWeek({ dueOn: '2026-10-19', releaseOn: null })).toBe('2026-10-19');
    expect(itemWeek({ dueOn: '2026-10-25', releaseOn: null })).toBe('2026-10-19');
    expect(itemWeek({ dueOn: '2026-10-26', releaseOn: null })).toBe('2026-10-26');
  });
  it('changement de mois et d’année', () => {
    expect(itemWeek({ dueOn: '2026-11-01', releaseOn: null })).toBe('2026-10-26');
    expect(itemWeek({ dueOn: '2027-01-03', releaseOn: null })).toBe('2026-12-28');
  });
  it('« aujourd’hui » vient du jour local : dimanche soir et lundi matin ne sont pas la même semaine', () => {
    const items = [item('todo', { dueOn: '2026-10-25' })];
    expect(weekItems(items, '2026-10-19', '2026-10-25')).toHaveLength(1);
    expect(weekItems(items, '2026-10-26', '2026-10-26')).toHaveLength(1); // reportée (délai de grâce)
    expect(weekItems(items, '2026-10-19', '2026-10-26')).toHaveLength(1); // et toujours dans son historique
  });
});

describe('daysUntil / urgence', () => {
  it('jours calendaires signés', () => {
    expect(daysUntil('2026-10-23', TODAY)).toBe(2);
    expect(daysUntil('2026-10-21', TODAY)).toBe(0);
    expect(daysUntil('2026-10-20', TODAY)).toBe(-1);
    expect(daysUntil('2027-01-01', '2026-12-31')).toBe(1);
  });
  it('seuil d’urgence : 2 jours', () => expect(URGENT_DAYS).toBe(2));
});

describe('tri des cartes', () => {
  it('non terminées par échéance, puis en attente, puis validées', () => {
    const list = [
      item('validated', { quizId: 'v', dueOn: '2026-10-20' }),
      item('waiting', { quizId: 'w', dueOn: '2026-10-19' }),
      item('todo', { quizId: 'late2', dueOn: '2026-10-24' }),
      item('in_progress', { quizId: 'early', dueOn: '2026-10-22' }),
      item('todo', { quizId: 'nodue', dueOn: null }),
    ];
    expect(sortCards(list).map((x) => x.quizId)).toEqual(['early', 'late2', 'nodue', 'w', 'v']);
  });
  it('à égalité : matière, titre, identifiant', () => {
    const a = item('todo', { quizId: 'b', subject: 'maths', title: 'Z' });
    const b = item('todo', { quizId: 'a', subject: 'maths', title: 'Z' });
    const c = item('todo', { quizId: 'c', subject: 'anglais', title: 'Z' });
    const d = item('todo', { quizId: 'd', subject: 'anglais', title: 'A' });
    expect(sortCards([a, b, c, d]).map((x) => x.quizId)).toEqual(['d', 'c', 'a', 'b']);
  });
});

describe('contenu d’une semaine', () => {
  const cur = item('todo', { quizId: 'cur' });
  const nextWeek = item('todo', { quizId: 'next', releaseOn: '2026-10-20', dueOn: '2026-10-30' });
  const lateInGrace = item('in_progress', { quizId: 'grace', releaseOn: '2026-10-12', dueOn: '2026-10-16' });
  const lateGone = item('todo', { quizId: 'gone', releaseOn: '2026-10-05', dueOn: '2026-10-09' });
  const oldWaiting = item('waiting', { quizId: 'oldw', releaseOn: '2026-09-01', dueOn: '2026-09-06' });
  const oldValidated = item('validated', { quizId: 'oldv', releaseOn: '2026-10-12', dueOn: '2026-10-16' });
  const all = [cur, nextWeek, lateInGrace, lateGone, oldWaiting, oldValidated];

  it('semaine courante : ses quiz + le retard dans le délai de grâce + les quiz en attente (jamais le retard au-delà, ni les validés anciens)', () => {
    expect(weekItems(all, '2026-10-19', TODAY).map((x) => x.quizId).sort()).toEqual(['cur', 'grace', 'oldw']);
  });
  it('délai de grâce : jusqu’au dimanche de la semaine qui suit l’échéance, inclus', () => {
    const q = [item('todo', { quizId: 'g', releaseOn: '2026-10-05', dueOn: '2026-10-09' })]; // semaine du 5/10 → grâce jusqu’au 18/10
    expect(weekItems(q, '2026-10-12', '2026-10-18')).toHaveLength(1);
    expect(weekItems(q, '2026-10-19', '2026-10-18')).toHaveLength(0);
    expect(weekItems(q, '2026-10-19', '2026-10-19')).toHaveLength(0);
  });
  it('semaine passée : historique par échéance, résultats compris', () => {
    expect(weekItems(all, '2026-10-12', TODAY).map((x) => x.quizId).sort()).toEqual(['grace', 'oldv']);
  });
  it('semaine future : seulement ce qui est déjà ouvert', () => {
    expect(weekItems(all, '2026-10-26', TODAY).map((x) => x.quizId)).toEqual(['next']);
    expect(weekItems([], '2026-11-02', TODAY)).toEqual([]);
  });
  it('0, 1 et 6 matières', () => {
    expect(weekItems([], '2026-10-19', TODAY)).toEqual([]);
    expect(weekItems([cur], '2026-10-19', TODAY)).toHaveLength(1);
    const six = ['maths', 'francais', 'anglais', 'hist_geo', 'sciences', 'techno'].map((s) => item('todo', { subject: s }));
    expect(weekItems(six, '2026-10-19', TODAY).map((x) => x.subject)).toEqual(['anglais', 'francais', 'hist_geo', 'maths', 'sciences', 'techno']);
  });
});

describe('statistiques et échéance la plus proche', () => {
  const list = [item('validated'), item('waiting'), item('todo', { dueOn: '2026-10-25' }), item('in_progress', { dueOn: '2026-10-23' })];
  it('compte validés / en attente / non terminés', () => {
    expect(weekStats(list)).toEqual({ total: 4, validated: 1, waiting: 1, unfinished: 2 });
    expect(weekStats([])).toEqual({ total: 0, validated: 0, waiting: 0, unfinished: 0 });
    expect(isUnfinished(item('todo'))).toBe(true);
    expect(isUnfinished(item('waiting'))).toBe(false);
  });
  it('la plus proche parmi les non terminées ; rouge à 2 jours ou moins', () => {
    const n1 = nearestDue(list, TODAY);
    expect(n1?.item.dueOn).toBe('2026-10-23');
    expect(n1).toMatchObject({ days: 2, urgent: true });
    expect(nearestDue([item('todo', { dueOn: '2026-10-25' })], TODAY)).toMatchObject({ days: 4, urgent: false });
  });
  it('en retard : jours négatifs, rouge', () => {
    expect(nearestDue([item('todo', { dueOn: '2026-10-18' })], TODAY)).toMatchObject({ days: -3, urgent: true });
  });
  it('rien à faire (tout envoyé ou validé, ou sans échéance) : aucune échéance', () => {
    expect(nearestDue([item('waiting'), item('validated')], TODAY)).toBeNull();
    expect(nearestDue([item('todo', { dueOn: null })], TODAY)).toBeNull();
    expect(nearestDue([], TODAY)).toBeNull();
  });
});

describe('numéro de semaine', () => {
  it('celui du libellé du catalogue, le plus fréquent ; égalité : le plus petit', () => {
    expect(weekNumber([item('todo', { weekLabel: 'Tuần 8' }), item('todo', { weekLabel: 'Tuần 8' }), item('todo', { weekLabel: 'Tuần 7' })], '2026-10-19')).toBe(8);
    expect(weekNumber([item('todo', { weekLabel: 'Tuần 9' }), item('todo', { weekLabel: 'Tuần 7' })], '2026-10-19')).toBe(7);
  });
  it('sans chiffre ni quiz : semaine ISO', () => {
    expect(weekNumber([item('todo', { weekLabel: 'Semaine A' })], '2026-10-19')).toBe(43);
    expect(weekNumber([], '2026-12-28')).toBe(53);
  });
  it('un quiz reporté d’une autre semaine ne donne pas le numéro de la semaine courante', () => {
    const carried = item('todo', { weekLabel: 'Tuần 7', releaseOn: '2026-10-12', dueOn: '2026-10-16' });
    const own = item('todo', { weekLabel: 'Tuần 8' });
    expect(weekNumber([carried, own], '2026-10-19')).toBe(8);
    expect(weekNumber([carried], '2026-10-19')).toBe(7);
  });
});

describe('navigation entre semaines', () => {
  const items = [item('validated', { dueOn: '2026-10-09', releaseOn: '2026-10-05' }), item('todo', { dueOn: '2026-10-30', releaseOn: '2026-10-20' })];
  it('bornes : première semaine avec un quiz → dernière ; la semaine courante est toujours incluse', () => {
    expect(weekBounds(items, TODAY)).toEqual({ min: '2026-10-05', max: '2026-10-26' });
    expect(weekBounds([], TODAY)).toEqual({ min: '2026-10-19', max: '2026-10-19' });
  });
  it('en-tête : dates lundi → dimanche, k/n, flèches', () => {
    const h = weekHeader(items, '2026-10-19', TODAY);
    expect(h).toMatchObject({ start: '2026-10-19', end: '2026-10-25', canPrev: true, canNext: true, total: 0 });
    const past = weekHeader(items, '2026-10-05', TODAY);
    expect(past).toMatchObject({ end: '2026-10-11', validated: 1, total: 1, canPrev: false, canNext: true });
    const last = weekHeader(items, '2026-10-26', TODAY);
    expect(last).toMatchObject({ canPrev: true, canNext: false, end: '2026-11-01' });
  });
});

describe('bandeau de Hôm nay', () => {
  it('masqué : aucun quiz', () => expect(bannerModel([], TODAY)).toBeNull());
  it('masqué : quiz d’une autre semaine seulement, ou retard hors délai de grâce', () => {
    expect(bannerModel([item('todo', { dueOn: '2026-10-30', releaseOn: '2026-10-20' })], TODAY)).toBeNull();
    expect(bannerModel([item('todo', { releaseOn: '2026-10-05', dueOn: '2026-10-09' })], TODAY)).toBeNull();
    expect(bannerModel([item('validated', { releaseOn: '2026-10-05', dueOn: '2026-10-09' })], TODAY)).toBeNull();
  });
  it('en cours : k/n, barre, échéance la plus proche', () => {
    const b = bannerModel([item('validated', { weekLabel: 'Tuần 8' }), item('todo', { dueOn: '2026-10-23' }), item('in_progress', { dueOn: '2026-10-25' }), item('waiting')], TODAY);
    expect(b).toMatchObject({ weekNo: 8, total: 4, validated: 1, done: false, waiting: 1, toValidate: 1 });
    expect(b?.nearest).toMatchObject({ days: 2, urgent: true });
  });
  it('en attente de validation seulement : pas d’échéance, le bandeau reste', () => {
    const b = bannerModel([item('waiting'), item('validated')], TODAY);
    expect(b).toMatchObject({ total: 2, validated: 1, done: false, waiting: 1, nearest: null });
  });
  it('tout validé : « xong »', () => {
    const b = bannerModel([item('validated'), item('validated')], TODAY);
    expect(b).toMatchObject({ done: true, validated: 2, total: 2, nearest: null });
  });
  it('en retard dans le délai de grâce : le bandeau reste, échéance négative en rouge', () => {
    const b = bannerModel([item('todo', { releaseOn: '2026-10-12', dueOn: '2026-10-16', weekLabel: 'Tuần 7' })], TODAY);
    expect(b).toMatchObject({ weekNo: 7, total: 1, validated: 0 });
    expect(b?.nearest).toMatchObject({ days: -5, urgent: true });
  });
  it('parent : un quiz à valider reste signalé même sans quiz cette semaine', () => {
    const b = bannerModel([item('waiting', { releaseOn: '2026-10-26', dueOn: '2026-10-30' })], TODAY);
    expect(b).toMatchObject({ toValidate: 1, total: 0, done: false });
    expect(b?.weekNo).toBe(8);
  });
  it('6 matières', () => {
    const six = Array.from({ length: 6 }, (_, i) => item(i < 2 ? 'validated' : 'todo', { subject: `s${i}`, dueOn: `2026-10-2${i % 5}` }));
    expect(bannerModel(six, TODAY)).toMatchObject({ total: 6, validated: 2, done: false });
  });
});

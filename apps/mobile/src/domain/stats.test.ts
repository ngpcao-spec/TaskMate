import { completionBuckets, computeStats, encouragementFor, formatRate, periodRange } from './stats';

const t = (date: string, category: 'study' | 'sport' | 'chores' | 'personal' | 'other', done: boolean, deleted = false) => ({
  date, category, completed_at: done ? '2026-07-01T10:00:00Z' : null, deleted_at: deleted ? '2026-07-01T10:00:00Z' : null,
});

describe('periodRange', () => {
  it('semaine : lundi → dimanche autour d’un jeudi', () => {
    expect(periodRange('week', '2026-07-02')).toEqual({ from: '2026-06-29', to: '2026-07-05' });
  });
  it('semaine : un dimanche reste dans sa semaine', () => {
    expect(periodRange('week', '2026-07-05')).toEqual({ from: '2026-06-29', to: '2026-07-05' });
  });
  it('mois civil, fin de mois et février bissextile', () => {
    expect(periodRange('month', '2026-07-02')).toEqual({ from: '2026-07-01', to: '2026-07-31' });
    expect(periodRange('month', '2028-02-10')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
  });
});

describe('computeStats', () => {
  const tasks = [
    t('2026-07-01', 'study', true), t('2026-07-02', 'study', true), t('2026-07-03', 'sport', false),
    t('2026-07-04', 'chores', true), t('2026-07-05', 'other', false),
    t('2026-06-28', 'study', true),           // hors semaine
    t('2026-07-02', 'sport', true, true),     // supprimée
  ];
  it('compte total / faites / non faites sur la période, hors supprimées', () => {
    const s = computeStats(tasks, '2026-06-29', '2026-07-05');
    expect(s).toMatchObject({ total: 5, done: 3, notDone: 2, rate: 60 });
  });
  it('répartition par catégorie = part du total', () => {
    const s = computeStats(tasks, '2026-06-29', '2026-07-05');
    expect(s.byCategory.find((c) => c.category === 'study')).toEqual({ category: 'study', count: 2, percent: 40 });
    expect(s.byCategory.find((c) => c.category === 'personal')).toEqual({ category: 'personal', count: 0, percent: 0 });
    expect(s.byCategory).toHaveLength(5);
  });
  it('période vide : taux null (« — »), jamais NaN', () => {
    const s = computeStats([], '2026-07-01', '2026-07-31');
    expect(s).toMatchObject({ total: 0, done: 0, notDone: 0, rate: null });
    expect(s.byCategory.every((c) => c.percent === 0 && c.count === 0)).toBe(true);
    expect(formatRate(s.rate)).toBe('—');
    expect(formatRate(s.rate)).not.toMatch(/NaN/);
  });
  it('toutes supprimées ou hors période = vide', () => {
    expect(computeStats([t('2026-07-02', 'study', true, true)], '2026-07-01', '2026-07-31').rate).toBeNull();
    expect(computeStats([t('2026-08-02', 'study', true)], '2026-07-01', '2026-07-31').rate).toBeNull();
  });
  it('arrondi du taux', () => {
    const s = computeStats([t('2026-07-01', 'study', true), t('2026-07-01', 'study', false), t('2026-07-01', 'study', false)], '2026-07-01', '2026-07-31');
    expect(s.rate).toBe(33);
    expect(formatRate(33)).toBe('33%');
  });
  it('tâche 100 % faites', () => {
    expect(computeStats([t('2026-07-01', 'study', true)], '2026-07-01', '2026-07-31').rate).toBe(100);
  });
});

describe('encouragementFor (§5.4)', () => {
  it.each([[100, 'excellent'], [80, 'excellent'], [79, 'good'], [50, 'good'], [49, 'keepGoing'], [0, 'keepGoing']])('%i %% → %s', (rate, expected) => {
    expect(encouragementFor(rate)).toBe(expected);
  });
  it('aucune carte quand la période est vide', () => expect(encouragementFor(null)).toBeNull());
});

describe('completionBuckets (graphique en barres)', () => {
  const tasks = [
    t('2026-07-01', 'study', true), t('2026-07-01', 'sport', false), t('2026-07-03', 'study', true),
    t('2026-07-02', 'sport', true, true), // supprimée : ignorée
    t('2026-06-28', 'study', true), // hors période
  ];
  it('semaine : sept barres, une par jour, lundi → dimanche', () => {
    const b = completionBuckets(tasks, 'week', '2026-06-29', '2026-07-05');
    expect(b.map((x) => x.from)).toEqual(['2026-06-29', '2026-06-30', '2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04', '2026-07-05']);
    expect(b.every((x) => x.from === x.to)).toBe(true);
    expect(b.map((x) => [x.done, x.total])).toEqual([[0, 0], [0, 0], [1, 2], [0, 0], [1, 1], [0, 0], [0, 0]]);
  });
  it('mois : une barre par semaine, première et dernière semaines bornées au mois', () => {
    const b = completionBuckets(tasks, 'month', '2026-07-01', '2026-07-31');
    expect(b.map((x) => [x.from, x.to])).toEqual([
      ['2026-07-01', '2026-07-05'], ['2026-07-06', '2026-07-12'], ['2026-07-13', '2026-07-19'], ['2026-07-20', '2026-07-26'], ['2026-07-27', '2026-07-31'],
    ]);
    expect(b[0]).toMatchObject({ done: 2, total: 3 });
    expect(b.slice(1).every((x) => x.total === 0 && x.done === 0)).toBe(true);
  });
  it('mois finissant un dimanche : pas de barre vide en trop', () => {
    expect(completionBuckets([], 'month', '2026-05-01', '2026-05-31').at(-1)).toMatchObject({ from: '2026-05-25', to: '2026-05-31' });
  });
  it('la somme des barres égale le total des statistiques', () => {
    const s = computeStats(tasks, '2026-07-01', '2026-07-31');
    const b = completionBuckets(tasks, 'month', '2026-07-01', '2026-07-31');
    expect(b.reduce((n, x) => n + x.total, 0)).toBe(s.total);
    expect(b.reduce((n, x) => n + x.done, 0)).toBe(s.done);
  });
  it('période sans tâche : barres à zéro, jamais NaN', () => {
    expect(completionBuckets([], 'week', '2026-06-29', '2026-07-05').every((x) => x.done === 0 && x.total === 0)).toBe(true);
  });
});

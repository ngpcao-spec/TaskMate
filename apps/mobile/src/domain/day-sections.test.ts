import { celebrationAction, dayComplete, daySectionOf, groupByDaySection, remainingCount } from './day-sections';

type T = { title: string; time_kind: 'range' | 'deadline' | 'anytime'; start_time: string | null; end_time: string | null; completed_at: string | null };
const range = (title: string, start: string, end: string, done = false): T => ({ title, time_kind: 'range', start_time: start, end_time: end, completed_at: done ? 'x' : null });
const deadline = (title: string, end: string): T => ({ title, time_kind: 'deadline', start_time: null, end_time: end, completed_at: null });
const anytime = (title: string, done = false): T => ({ title, time_kind: 'anytime', start_time: null, end_time: null, completed_at: done ? 'x' : null });

describe('moments de la journée (D-106)', () => {
  it('bornes : avant 12 h, 12 h – 18 h, 18 h et après', () => {
    expect(daySectionOf(range('a', '00:00:00', '01:00:00'))).toBe('morning');
    expect(daySectionOf(range('a', '11:59', '12:30'))).toBe('morning');
    expect(daySectionOf(range('a', '12:00', '13:00'))).toBe('afternoon');
    expect(daySectionOf(range('a', '17:59', '19:00'))).toBe('afternoon');
    expect(daySectionOf(range('a', '18:00', '19:00'))).toBe('evening');
    expect(daySectionOf(range('a', '23:30', '23:59'))).toBe('evening');
  });
  it('range → début, deadline → échéance, anytime → quand je veux', () => {
    expect(daySectionOf(range('a', '11:00', '13:00'))).toBe('morning'); // commence le matin même s'il finit l'après-midi
    expect(daySectionOf(deadline('b', '12:00'))).toBe('afternoon');
    expect(daySectionOf(deadline('b', '07:30'))).toBe('morning');
    expect(daySectionOf(anytime('c'))).toBe('anytime');
    expect(daySectionOf({ time_kind: 'range', start_time: null, end_time: null })).toBe('anytime');
    expect(daySectionOf({ time_kind: 'deadline', start_time: null, end_time: '99:00' })).toBe('anytime');
  });
  it('groupes dans l’ordre de la journée, triés par heure, vides masqués', () => {
    const g = groupByDaySection([anytime('Z'), range('Soir', '19:00', '20:00'), range('Tard', '08:30', '09:00'), range('Tôt', '07:00', '07:30')]);
    expect(g.map((x) => x.section)).toEqual(['morning', 'evening', 'anytime']);
    expect(g[0]!.items.map((t) => t.title)).toEqual(['Tôt', 'Tard']);
    expect(groupByDaySection([])).toEqual([]);
  });
  it('la révision de la semaine fait apparaître « quand je veux » même sans tâche', () => {
    expect(groupByDaySection([range('a', '08:00', '09:00')], true).map((x) => x.section)).toEqual(['morning', 'anytime']);
    expect(groupByDaySection([], true)).toEqual([{ section: 'anytime', items: [] }]);
  });
});

describe('fin de journée (D-106)', () => {
  it('au moins une tâche prévue et toutes cochées (en attente comprise)', () => {
    expect(dayComplete([])).toBe(false);
    expect(dayComplete([anytime('a', true)])).toBe(true);
    expect(dayComplete([anytime('a', true), anytime('b')])).toBe(false);
    expect(remainingCount([anytime('a', true), anytime('b'), anytime('c')])).toBe(2);
  });
  it('bouton : partir si la jauge est pleine, sinon l’énergie qui manque', () => {
    expect(celebrationAction({ state: 'ready_to_go', gauge: 60, cost: 60 })).toEqual({ kind: 'go' });
    expect(celebrationAction({ state: 'filling', gauge: 42, cost: 60 })).toEqual({ kind: 'missing', energy: 18 });
    expect(celebrationAction({ state: 'filling', gauge: 60, cost: 60 })).toEqual({ kind: 'missing', energy: 1 });
    expect(celebrationAction({ state: 'away', gauge: 10, cost: 60 })).toBeNull();
    expect(celebrationAction({ state: 'back', gauge: 10, cost: 60 })).toBeNull();
    expect(celebrationAction(null)).toBeNull();
  });
});

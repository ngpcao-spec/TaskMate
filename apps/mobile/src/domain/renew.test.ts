import type { TaskRow } from '@/types/models';
import {
  MAX_CREATED, addDaysIso, addMonths, copyFields, duplicateKey, isoWeekday, monthGrid, monthStartOf, occurrenceDates, planOneOff, planSeries, seriesEndsOn,
} from './renew';

const source = {
  id: 's1', family_id: 'f', child_id: 'minh', title: 'Piano', category: 'personal', note: 'Gamme', date: '2026-07-02', time_kind: 'range',
  start_time: '08:00:00', end_time: '08:45:00', points: 15, completed_at: '2026-07-02T01:00:00Z', completed_by: 'm', validated_at: '2026-07-02T02:00:00Z',
  validated_by: 'p', rejection_note: 'non', rejected_at: 'x', recurrence_id: 'r1', created_by: 'p', created_at: 'x', updated_at: 'x', deleted_at: null,
} as unknown as TaskRow;
const existing = (over: Partial<TaskRow>): TaskRow => ({ ...source, id: 'e', completed_at: null, validated_at: null, recurrence_id: null, ...over }) as TaskRow;

describe('jours de la semaine ISO (lundi = 1 … dimanche = 7, jeudi = 4)', () => {
  it.each([
    ['2026-06-29', 1, 'lundi'],
    ['2026-06-30', 2, 'mardi'],
    ['2026-07-01', 3, 'mercredi'],
    ['2026-07-02', 4, 'jeudi'],
    ['2026-07-03', 5, 'vendredi'],
    ['2026-07-04', 6, 'samedi'],
    ['2026-07-05', 7, 'dimanche'],
  ])('%s → %i (%s)', (date, iso) => expect(isoWeekday(date)).toBe(iso));

  it('indépendant du fuseau de l’appareil : minuit-frontière, passage d’année, bissextile', () => {
    expect(isoWeekday('2026-01-01')).toBe(4); // jeudi 1er janvier 2026
    expect(isoWeekday('2024-02-29')).toBe(4); // jeudi 29 février 2024
    expect(isoWeekday('2026-12-31')).toBe(4);
  });
});

describe('arithmétique de dates', () => {
  it('addDaysIso traverse mois, années et février bissextile', () => {
    expect(addDaysIso('2026-07-31', 1)).toBe('2026-08-01');
    expect(addDaysIso('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysIso('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDaysIso('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('mois : début, décalage, passage d’année', () => {
    expect(monthStartOf('2026-07-19')).toBe('2026-07-01');
    expect(addMonths('2026-12-01', 1)).toBe('2027-01-01');
    expect(addMonths('2026-01-01', -1)).toBe('2025-12-01');
  });
  it('grille de juillet 2026 : commence un mercredi (2 cases vides), 5 semaines, 31 jours', () => {
    const grid = monthGrid('2026-07-01');
    expect(grid).toHaveLength(5);
    expect(grid[0]).toEqual([null, null, '2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04', '2026-07-05']);
    expect(grid.flat().filter(Boolean)).toHaveLength(31);
    expect(grid.every((w) => w.length === 7)).toBe(true);
    for (const day of grid.flat()) if (day) expect(isoWeekday(day)).toBe(grid.flat().indexOf(day) % 7 + 1);
  });
});

describe('fin de série', () => {
  it('sans fin → null ; date → telle quelle ; N semaines → début + 7N − 1 jours', () => {
    expect(seriesEndsOn('2026-07-06', { kind: 'never' })).toBeNull();
    expect(seriesEndsOn('2026-07-06', { kind: 'date', date: '2026-08-01' })).toBe('2026-08-01');
    expect(seriesEndsOn('2026-07-06', { kind: 'weeks', weeks: 1 })).toBe('2026-07-12'); // lundi → dimanche
    expect(seriesEndsOn('2026-07-06', { kind: 'weeks', weeks: 4 })).toBe('2026-08-02');
  });
  it('occurrences : lundi + jeudi sur 2 semaines', () => {
    expect(occurrenceDates('2026-07-06', '2026-07-19', [1, 4])).toEqual(['2026-07-06', '2026-07-09', '2026-07-13', '2026-07-16']);
  });
  it('les bornes sont incluses', () => {
    expect(occurrenceDates('2026-07-02', '2026-07-02', [4])).toEqual(['2026-07-02']);
    expect(occurrenceDates('2026-07-03', '2026-07-08', [4])).toEqual([]);
  });
});

describe('copie', () => {
  it('reprend titre, catégorie, points, note, plage horaire, enfant ; aucun état', () => {
    const copy = copyFields(source, 'khang', '2026-07-09');
    expect(copy).toEqual({ child_id: 'khang', title: 'Piano', category: 'personal', note: 'Gamme', date: '2026-07-09', time_kind: 'range', start_time: '08:00:00', end_time: '08:45:00', points: 15 });
    expect(Object.keys(copy)).not.toEqual(expect.arrayContaining(['completed_at', 'validated_at', 'rejection_note', 'recurrence_id']));
  });
  it('clé de doublon : casse/espaces ignorés dans le titre, secondes ignorées dans l’heure', () => {
    const a = duplicateKey(copyFields(source, 'minh', '2026-07-09'));
    expect(duplicateKey({ ...copyFields(source, 'minh', '2026-07-09'), title: '  piano ', start_time: '08:00', end_time: '08:45' })).toBe(a);
    expect(duplicateKey({ ...copyFields(source, 'minh', '2026-07-09'), end_time: '09:00:00' })).not.toBe(a);
    expect(duplicateKey(copyFields(source, 'khang', '2026-07-09'))).not.toBe(a);
  });
});

describe('planOneOff — autres jours', () => {
  it('une tâche par jour choisi, dédoublonne les jours, source non modifiée', () => {
    const plan = planOneOff({ source, childIds: ['minh'], dates: ['2026-07-10', '2026-07-09', '2026-07-09'], existing: [source] });
    expect(plan.toCreate.map((t) => t.date)).toEqual(['2026-07-09', '2026-07-10']);
    expect(plan.first).toBe('2026-07-09');
    expect(plan.last).toBe('2026-07-10');
    expect(plan.skipped).toEqual([]);
    expect(source.completed_at).not.toBeNull();
  });
  it('plusieurs enfants : chacun reçoit sa propre tâche', () => {
    const plan = planOneOff({ source, childIds: ['minh', 'khang'], dates: ['2026-07-09'], existing: [] });
    expect(plan.toCreate.map((t) => `${t.child_id}@${t.date}`)).toEqual(['minh@2026-07-09', 'khang@2026-07-09']);
  });
  it('doublon exact : non recréé et signalé ; autre heure ou autre enfant : créé', () => {
    const plan = planOneOff({
      source, childIds: ['minh', 'khang'], dates: ['2026-07-09'],
      existing: [existing({ date: '2026-07-09' }), existing({ child_id: 'khang', date: '2026-07-09', end_time: '09:30:00' })],
    });
    expect(plan.skipped).toEqual([{ child_id: 'minh', date: '2026-07-09' }]);
    expect(plan.toCreate.map((t) => t.child_id)).toEqual(['khang']);
  });
  it('une tâche supprimée n’est pas un doublon', () => {
    const plan = planOneOff({ source, childIds: ['minh'], dates: ['2026-07-09'], existing: [existing({ date: '2026-07-09', deleted_at: '2026-07-01T00:00:00Z' })] });
    expect(plan.count).toBe(1);
  });
  it('plafond', () => {
    const dates = Array.from({ length: MAX_CREATED + 1 }, (_, i) => addDaysIso('2026-07-01', i));
    expect(planOneOff({ source, childIds: ['minh'], dates, existing: [] }).tooMany).toBe(true);
    expect(planOneOff({ source, childIds: ['minh'], dates: dates.slice(0, MAX_CREATED), existing: [] }).tooMany).toBe(false);
    expect(planOneOff({ source, childIds: ['minh', 'khang'], dates: dates.slice(0, 61), existing: [] }).tooMany).toBe(true); // 2 × 61 > 120
  });
  it('aucun jour : rien à créer', () => {
    expect(planOneOff({ source, childIds: ['minh'], dates: [], existing: [] })).toMatchObject({ count: 0, first: null, last: null, tooMany: false });
  });
});

describe('planSeries — chaque semaine', () => {
  const base = { source, childIds: ['minh'], weekdays: [4, 1], start: '2026-07-06', today: '2026-07-03', existing: [] as TaskRow[] };

  it('jeudi = ISO 4 (jamais 3), jours triés et uniques, une série par enfant', () => {
    const plan = planSeries({ ...base, weekdays: [4, 4], childIds: ['minh', 'khang'], end: { kind: 'never' } });
    expect(plan.series.map((s) => s.weekdays)).toEqual([[4], [4]]);
    expect(plan.series.map((s) => s.child_id)).toEqual(['minh', 'khang']);
    expect(plan.series[0]).toMatchObject({ rule: 'weekdays', starts_on: '2026-07-06', ends_on: null, title: 'Piano', points: 15, start_time: '08:00:00' });
    expect(planSeries({ ...base, end: { kind: 'never' } }).series[0]?.weekdays).toEqual([1, 4]);
  });
  it('N semaines : fin calculée, total exact', () => {
    const plan = planSeries({ ...base, end: { kind: 'weeks', weeks: 4 } });
    expect(plan.endsOn).toBe('2026-08-02');
    expect(plan.count).toBe(8); // 4 lundis + 4 jeudis
    expect(plan.first).toBe('2026-07-06');
    expect(plan.last).toBe('2026-07-30');
    expect(plan.upcoming).toBe(4); // 6, 9, 13 juillet… sur les 14 premiers jours (6→19) : lun 6, jeu 9, lun 13, jeu 16
  });
  it('date de fin ; plusieurs enfants multiplient le total', () => {
    const plan = planSeries({ ...base, childIds: ['minh', 'khang'], end: { kind: 'date', date: '2026-07-19' } });
    expect(plan.count).toBe(8); // 4 jours × 2 enfants
  });
  it('sans fin : total inconnu, 14 jours à l’avance', () => {
    const plan = planSeries({ ...base, end: { kind: 'never' } });
    expect(plan).toMatchObject({ count: null, endsOn: null, last: null, upcoming: 4, error: null });
  });
  it('série courte : le « à venir » ne dépasse pas la fin', () => {
    expect(planSeries({ ...base, end: { kind: 'weeks', weeks: 1 } }).upcoming).toBe(2);
  });
  it('validations', () => {
    expect(planSeries({ ...base, weekdays: [], end: { kind: 'never' } }).error).toBe('weekdaysRequired');
    expect(planSeries({ ...base, start: '2026-07-01', end: { kind: 'never' } }).error).toBe('startPast');
    expect(planSeries({ ...base, end: { kind: 'date', date: '2026-07-01' } }).error).toBe('endBeforeStart');
    expect(planSeries({ ...base, end: { kind: 'date', date: '2028-01-01' } }).error).toBe('endTooFar');
    expect(planSeries({ ...base, end: { kind: 'weeks', weeks: 0 } }).error).toBe('weeksInvalid');
    expect(planSeries({ ...base, end: { kind: 'weeks', weeks: 53 } }).error).toBe('weeksInvalid');
    expect(planSeries({ ...base, weekdays: [8, 0], end: { kind: 'never' } }).error).toBe('weekdaysRequired');
    expect(planSeries({ ...base, end: { kind: 'never' } }).error).toBeNull();
  });
  it('plafond : 7 jours × 52 semaines × 1 enfant dépasse, 1 jour × 52 non', () => {
    expect(planSeries({ ...base, weekdays: [1, 2, 3, 4, 5, 6, 7], end: { kind: 'weeks', weeks: 52 } }).tooMany).toBe(true);
    expect(planSeries({ ...base, weekdays: [1], end: { kind: 'weeks', weeks: 52 } }).tooMany).toBe(false);
  });
  it('conflits : occurrence des 14 prochains jours déjà présente à l’identique', () => {
    const plan = planSeries({ ...base, end: { kind: 'never' }, existing: [existing({ date: '2026-07-09' }), existing({ date: '2026-07-10' }), existing({ date: '2026-07-30' })] });
    expect(plan.conflicts).toEqual([{ child_id: 'minh', date: '2026-07-09' }]); // le 10 n'est pas dans la série, le 30 est hors fenêtre
  });
});

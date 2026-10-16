import { adminQuizState, canShift, clampOffset, effectiveDates, filterCatalog, GRADES, gradesFor, isAvailable, isCountry, isGradeOf, isSubject, MAX_WEEK_OFFSET, normalizeGradeFor, subjectLabelKey, SUBJECTS, suggestedDates } from '@/domain/catalog';

describe('domaine du catalogue (D-080)', () => {
  it('pays et matières connus ; clé i18n seulement pour une matière de la liste', () => {
    expect(isCountry('VN')).toBe(true);
    expect(isCountry('FR')).toBe(true);
    expect(isCountry('XX')).toBe(false);
    expect(isCountry(null)).toBe(false);
    expect(isSubject('hist_geo')).toBe(true);
    expect(isSubject('inconnue')).toBe(false);
    expect(subjectLabelKey('maths')).toBe('catalog.subject.maths');
    expect(subjectLabelKey('inconnue')).toBeNull();
    expect(SUBJECTS.every((s) => /^[a-z][a-z_]{1,29}$/.test(s))).toBe(true);
  });

  it('classes : liste fermée par pays (VN 1 à 12 ; FR CP … TERM)', () => {
    expect(GRADES.VN).toHaveLength(12);
    expect(GRADES.FR).toEqual(['CP', 'CE1', 'CE2', 'CM1', 'CM2', '6E', '5E', '4E', '3E', '2DE', '1RE', 'TERM']);
    expect(gradesFor('VN')[0]).toBe('1');
    expect(gradesFor('FR')).toBe(GRADES.FR);
    expect(gradesFor('XX')).toEqual([]);
    expect(gradesFor(null)).toEqual([]);
    expect(isGradeOf('VN', '5')).toBe(true);
    expect(isGradeOf('FR', '5')).toBe(false); // VN ≠ FR
    expect(isGradeOf('VN', '5E')).toBe(false);
    expect(isGradeOf('VN', null)).toBe(false);
  });

  // MÊMES cas que le test pgTAP de `catalog_normalize_grade` (supabase/tests/database/30_catalog_grades.test.sql)
  it.each([
    ['VN', '5', '5'], ['VN', ' 5 ', '5'], ['VN', 'lớp 5', '5'], ['VN', 'Lớp 5', '5'], ['VN', 'lop 5', '5'], ['VN', 'Lớp5', '5'], ['VN', 'classe 5', '5'], ['VN', '05', '5'],
    ['VN', '1', '1'], ['VN', '12', '12'], ['VN', 'Lớp 12', '12'],
    ['VN', '0', null], ['VN', '13', null], ['VN', '', null], ['VN', 'abc', null], ['VN', '5e', null], ['VN', 'CM2', null], ['VN', 'lớp', null],
    ['FR', '5e', '5E'], ['FR', '5E', '5E'], ['FR', '5ème', '5E'], ['FR', '5eme', '5E'], ['FR', '5°', '5E'], ['FR', ' 6 e ', '6E'], ['FR', 'classe 4e', '4E'], ['FR', '3EME', '3E'],
    ['FR', 'cp', 'CP'], ['FR', 'CE1', 'CE1'], ['FR', 'ce2', 'CE2'], ['FR', 'CM1', 'CM1'], ['FR', 'cm2', 'CM2'],
    ['FR', 'seconde', '2DE'], ['FR', '2nde', '2DE'], ['FR', '2DE', '2DE'], ['FR', 'première', '1RE'], ['FR', '1ère', '1RE'], ['FR', '1re', '1RE'], ['FR', 'terminale', 'TERM'], ['FR', 'Tle', 'TERM'], ['FR', 'TERM', 'TERM'],
    ['FR', '5', null], ['FR', '12', null], ['FR', '2e', null], ['FR', '7e', null], ['FR', 'CE3', null], ['FR', 'lớp 5', null], ['FR', '', null],
  ])('classe normalisée %s « %s » → %s', (country, raw, expected) => {
    expect(normalizeGradeFor(country, raw)).toBe(expected);
  });
  it('pays inconnu ou valeur absente : aucune classe', () => {
    expect(normalizeGradeFor('XX', '5')).toBeNull();
    expect(normalizeGradeFor(null, '5')).toBeNull();
    expect(normalizeGradeFor('VN', null)).toBeNull();
    expect(normalizeGradeFor('VN', undefined)).toBeNull();
  });

  it('décalage borné à ±4 semaines, un pas à la fois', () => {
    expect(clampOffset(9)).toBe(MAX_WEEK_OFFSET);
    expect(clampOffset(-9)).toBe(-MAX_WEEK_OFFSET);
    expect(clampOffset(1.9)).toBe(1);
    expect(canShift(0, -1)).toBe(true);
    expect(canShift(3, 1)).toBe(true);
    expect(canShift(4, 1)).toBe(false);
    expect(canShift(-4, -1)).toBe(false);
    expect(canShift(-4, 1)).toBe(true);
  });

  it('dates effectives = dates du catalogue + 7 jours × décalage (mise à disposition ET échéance)', () => {
    const d = { releaseOn: '2026-09-07', dueOn: '2026-09-13' };
    expect(effectiveDates(d, 0)).toEqual(d);
    expect(effectiveDates(d, 1)).toEqual({ releaseOn: '2026-09-14', dueOn: '2026-09-20' });
    expect(effectiveDates(d, -1)).toEqual({ releaseOn: '2026-08-31', dueOn: '2026-09-06' });
    expect(effectiveDates(d, 40)).toEqual(effectiveDates(d, 4));
    expect(effectiveDates({ releaseOn: null, dueOn: null }, 2)).toEqual({ releaseOn: null, dueOn: null });
  });

  it('disponibilité au JOUR LOCAL de la famille : le jour même oui, la veille de la mise à disposition non, l\'échéance n\'intervient pas', () => {
    expect(isAvailable('2026-09-07', 0, '2026-09-07')).toBe(true);
    expect(isAvailable('2026-09-07', 0, '2026-09-06')).toBe(false);
    expect(isAvailable('2026-09-07', 0, '2027-01-01')).toBe(true); // bien après l'échéance : toujours disponible
    expect(isAvailable('2026-09-14', -1, '2026-09-07')).toBe(true); // reculé d'une semaine
    expect(isAvailable('2026-09-07', 1, '2026-09-13')).toBe(false); // avancé d'une semaine
    expect(isAvailable('2026-09-07', 1, '2026-09-14')).toBe(true);
    expect(isAvailable(null, 0, '2026-09-07')).toBe(false);
    expect(isAvailable(undefined, 0, '2026-09-07')).toBe(false);
  });

  it('état affiché à l\'admin', () => {
    const base = { releaseOn: '2026-09-07', dueOn: '2026-09-13' };
    expect(adminQuizState({ status: 'draft', ...base }, '2026-09-08')).toBe('draft');
    expect(adminQuizState({ status: 'published', ...base }, '2026-09-06')).toBe('scheduled');
    expect(adminQuizState({ status: 'published', ...base }, '2026-09-07')).toBe('open');
    expect(adminQuizState({ status: 'published', ...base }, '2026-09-13')).toBe('open'); // le jour de l'échéance : encore dans les temps
    expect(adminQuizState({ status: 'published', ...base }, '2026-09-14')).toBe('ended');
    expect(adminQuizState({ status: 'published', releaseOn: null, dueOn: null }, '2026-09-14')).toBe('open');
  });

  it('dates proposées : échéance = le dimanche suivant', () => {
    expect(suggestedDates('2026-09-07')).toEqual({ releaseOn: '2026-09-07', dueOn: '2026-09-13' }); // lundi → dimanche de la semaine
    expect(suggestedDates('2026-09-13')).toEqual({ releaseOn: '2026-09-13', dueOn: '2026-09-20' }); // dimanche → dimanche prochain
  });

  it('filtres pays / classe / matière', () => {
    const list = [
      { id: 1, country: 'VN', grade: '5', subject: 'maths' },
      { id: 2, country: 'VN', grade: '6', subject: 'maths' },
      { id: 3, country: 'FR', grade: '6E', subject: 'anglais' },
    ];
    expect(filterCatalog(list, {}).map((q) => q.id)).toEqual([1, 2, 3]);
    expect(filterCatalog(list, { country: 'VN' }).map((q) => q.id)).toEqual([1, 2]);
    expect(filterCatalog(list, { country: 'VN', grade: '6' }).map((q) => q.id)).toEqual([2]);
    expect(filterCatalog(list, { subject: 'anglais' }).map((q) => q.id)).toEqual([3]);
    expect(filterCatalog(list, { country: 'FR', subject: 'maths' })).toEqual([]);
  });
});

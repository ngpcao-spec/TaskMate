import { adminQuizState, canShift, clampOffset, distinctGrades, effectiveDates, filterCatalog, isAvailable, isCountry, isSubject, MAX_WEEK_OFFSET, normalizeGrade, subjectLabelKey, SUBJECTS, suggestedDates } from '@/domain/catalog';

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

  it('classe normalisée (majuscules, 12 caractères maximum)', () => {
    expect(normalizeGrade(' 6e ')).toBe('6E');
    expect(normalizeGrade('5')).toBe('5');
    expect(normalizeGrade('')).toBeNull();
    expect(normalizeGrade('   ')).toBeNull();
    expect(normalizeGrade('x'.repeat(13))).toBeNull();
    expect(normalizeGrade('x'.repeat(12))).toBe('X'.repeat(12));
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
    expect(filterCatalog(list, { grade: '6e' }).map((q) => q.id)).toEqual([3]);
    expect(filterCatalog(list, { subject: 'anglais' }).map((q) => q.id)).toEqual([3]);
    expect(filterCatalog(list, { country: 'FR', subject: 'maths' })).toEqual([]);
  });

  it('classes distinctes : numériques en ordre numérique, puis le reste', () => {
    expect(distinctGrades([{ grade: '10' }, { grade: '5' }, { grade: '6E' }, { grade: '5' }, { grade: 'CP' }, { grade: '2' }])).toEqual(['2', '5', '6E', '10', 'CP']);
    expect(distinctGrades([])).toEqual([]);
  });
});

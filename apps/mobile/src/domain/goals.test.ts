import { clampProgress, formatGoalProgress, goalFormSchema, goalRatio, isGoalAchieved, justAchieved } from './goals';

describe('goals', () => {
  it('progression bornée à 0', () => {
    expect(clampProgress(-3)).toBe(0);
    expect(clampProgress(2.9)).toBe(2);
    expect(clampProgress(7)).toBe(7);
  });
  it('ratio plafonné à 1, jamais NaN', () => {
    expect(goalRatio(3, 5)).toBeCloseTo(0.6);
    expect(goalRatio(8, 5)).toBe(1);
    expect(goalRatio(1, 0)).toBe(0);
  });
  it('atteint = progression ≥ cible', () => {
    expect(isGoalAchieved(5, 5)).toBe(true);
    expect(isGoalAchieved(4, 5)).toBe(false);
  });
  it('détecte le passage à « atteint » (badge + toast une seule fois)', () => {
    expect(justAchieved(4, 5, 5)).toBe(true);
    expect(justAchieved(5, 6, 5)).toBe(false);
    expect(justAchieved(5, 4, 5)).toBe(false);
  });
  it('libellé « 3/5 » avec unité optionnelle', () => {
    expect(formatGoalProgress(3, 5)).toBe('3/5');
    expect(formatGoalProgress(4, 12, ' km ')).toBe('4/12 km');
    expect(formatGoalProgress(4, 12, '')).toBe('4/12');
  });
  it('validation du formulaire', () => {
    const ok = { title: ' Lire 5 livres ', icon: 'book-open', target: 5 };
    expect(goalFormSchema.parse(ok).title).toBe('Lire 5 livres');
    const err = (v: object) => { const r = goalFormSchema.safeParse({ ...ok, ...v }); return r.success ? [] : r.error.issues.map((i) => i.message); };
    expect(err({ title: ' ' })).toContain('titleRequired');
    expect(err({ target: 0 })).toContain('targetInvalid');
    expect(err({ target: 1.5 })).toContain('targetInvalid');
    expect(err({ target: 100001 })).toContain('targetInvalid');
    expect(err({ unit: 'x'.repeat(21) })).toContain('unitTooLong');
    expect(err({ icon: 'nope' })).not.toEqual([]);
  });
});

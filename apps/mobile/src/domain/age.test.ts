import { ageFromBirthDate } from './age';

describe('ageFromBirthDate', () => {
  it('counts full years', () => {
    expect(ageFromBirthDate('2009-07-02', '2026-07-01')).toBe(16);
    expect(ageFromBirthDate('2009-07-02', '2026-07-02')).toBe(17);
  });
  it('never returns a negative age', () => {
    expect(ageFromBirthDate('2030-01-01', '2026-01-01')).toBe(0);
  });
});

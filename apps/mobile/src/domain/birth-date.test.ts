import { validateBirthDate } from './birth-date';

const today = '2026-07-02';
describe('validateBirthDate', () => {
  it('accepte une date plausible', () => expect(validateBirthDate('2013-05-01', today)).toBeNull());
  it('refuse un mauvais format', () => expect(validateBirthDate('01/05/2013', today)).toBe('format'));
  it('refuse une date inexistante', () => expect(validateBirthDate('2013-02-30', today)).toBe('invalid'));
  it('refuse le futur', () => expect(validateBirthDate('2027-01-01', today)).toBe('future'));
  it('refuse > 25 ans', () => expect(validateBirthDate('1990-01-01', today)).toBe('tooOld'));
  it('gère l’anniversaire pas encore passé', () => expect(validateBirthDate('2001-07-03', today)).toBeNull());
});

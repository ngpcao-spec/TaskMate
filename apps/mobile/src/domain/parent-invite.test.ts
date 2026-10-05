import { formatInviteCode, isValidInviteCode, normalizeInviteCode, toJoinFailure } from './parent-invite';

describe('code d\'invitation parent', () => {
  it('normalise la saisie (casse, tirets, espaces)', () => {
    expect(normalizeInviteCode(' abcd-2345 ')).toBe('ABCD2345');
    expect(normalizeInviteCode('ab cd 23 45')).toBe('ABCD2345');
  });
  it('8 caractères de l\'alphabet sans ambiguïté (ni 0, 1, I, O)', () => {
    expect(isValidInviteCode('ABCD-2345')).toBe(true);
    expect(isValidInviteCode('abcd2345')).toBe(true);
    expect(isValidInviteCode('ABCD234')).toBe(false);
    expect(isValidInviteCode('ABCD23456')).toBe(false);
    expect(isValidInviteCode('ABCD0123')).toBe(false);
    expect(isValidInviteCode('ABCDIO23')).toBe(false);
  });
  it('affichage par groupes de 4', () => {
    expect(formatInviteCode('ABCD2345')).toBe('ABCD-2345');
    expect(formatInviteCode('ABC')).toBe('ABC');
  });
  it('erreurs serveur → codes stables', () => {
    expect(toJoinFailure('too_many_attempts')).toBe('tooManyAttempts');
    expect(toJoinFailure('google_required')).toBe('googleRequired');
    expect(toJoinFailure('already_member')).toBe('alreadyMember');
    expect(toJoinFailure('boom')).toBe('unknown');
    expect(toJoinFailure(undefined)).toBe('unknown');
  });
});

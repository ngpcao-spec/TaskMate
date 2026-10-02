import { buildInviteLink, isValidInviteCode, normalizeInviteCode, parseInviteLink } from './invite';

describe('invite codes', () => {
  it('normalise casse, espaces et tirets', () => {
    expect(normalizeInviteCode(' abc-234 ')).toBe('ABC234');
  });
  it('refuse les caractères ambigus et les mauvaises longueurs', () => {
    expect(isValidInviteCode('ABC234')).toBe(true);
    expect(isValidInviteCode('ABC0O1')).toBe(false);
    expect(isValidInviteCode('ABCDE')).toBe(false);
    expect(isValidInviteCode('ABCDEFG')).toBe(false);
  });
  it('lit un lien profond ou un code brut', () => {
    expect(parseInviteLink('taskmate://join?code=abc234')).toBe('ABC234');
    expect(parseInviteLink('taskmate://join?x=1&code=ABC234')).toBe('ABC234');
    expect(parseInviteLink('ABC234')).toBe('ABC234');
  });
  it('rejette tout le reste', () => {
    expect(parseInviteLink('https://example.com')).toBeNull();
    expect(parseInviteLink('taskmate://join?code=BAD')).toBeNull();
  });
  it('construit un lien relisible', () => {
    expect(parseInviteLink(buildInviteLink('abc234'))).toBe('ABC234');
  });
});

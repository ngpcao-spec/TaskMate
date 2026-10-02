import { buildInviteLink, buildShareableInviteLink, isValidInviteCode, normalizeInviteCode, parseInviteLink } from './invite';

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
  it('lit un lien web de jointure', () => {
    expect(parseInviteLink('https://taskmate.vercel.app/join?code=abc234')).toBe('ABC234');
    expect(parseInviteLink('http://localhost:8081/join?x=1&code=ABC234#frag')).toBe('ABC234');
  });
  it('construit un lien partageable web ou natif', () => {
    expect(buildShareableInviteLink('abc234', 'https://taskmate.vercel.app/')).toBe('https://taskmate.vercel.app/join?code=ABC234');
    expect(parseInviteLink(buildShareableInviteLink('abc234', 'https://x.app'))).toBe('ABC234');
    expect(buildShareableInviteLink('abc234', null)).toBe('taskmate://join?code=ABC234');
  });
  it('rejette tout le reste', () => {
    expect(parseInviteLink('https://example.com')).toBeNull();
    expect(parseInviteLink('https://example.com/other?code=ABC234')).toBeNull();
    expect(parseInviteLink('taskmate://join?code=BAD')).toBeNull();
  });
  it('construit un lien relisible', () => {
    expect(parseInviteLink(buildInviteLink('abc234'))).toBe('ABC234');
  });
});

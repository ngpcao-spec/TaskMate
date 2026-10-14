import { AVATAR_LIMITS, avatarErrorKey, avatarMap, avatarUri, NO_AVATAR } from '@/domain/avatar';

describe('avatar (D-071) : règles pures', () => {
  it('construit l’URI d’affichage d’un dessin WebP', () => {
    expect(avatarUri('UklGRg==')).toBe('data:image/webp;base64,UklGRg==');
  });

  it('indexe les lignes par enfant : consentement, image, version', () => {
    const map = avatarMap([
      { child_id: 'a', ai_allowed: true, image_b64: 'UklGRg==', version: 3 },
      { child_id: 'b', ai_allowed: false, image_b64: null, version: 0 },
    ]);
    expect(map.a).toEqual({ allowed: true, uri: 'data:image/webp;base64,UklGRg==', version: 3 });
    expect(map.b).toEqual({ allowed: false, uri: null, version: 0 });
    expect(map.c).toBeUndefined();
  });

  it('ignore une image qui n’est pas du WebP et une ligne sans identifiant (jamais d’URI hasardeuse)', () => {
    const map = avatarMap([
      { child_id: 'a', ai_allowed: true, image_b64: '<script>alert(1)</script>', version: 1 },
      { child_id: '', ai_allowed: true, image_b64: 'UklGRg==', version: 1 },
    ]);
    expect(map.a?.uri).toBeNull();
    expect(Object.keys(map)).toEqual(['a']);
  });

  it('sans avatar : valeur neutre, consentement faux', () => {
    expect(NO_AVATAR).toEqual({ allowed: false, uri: null, version: 0 });
  });

  it('le portrait est réduit avant envoi (≤ 1024 px, bien en deçà des 3 Mo du serveur)', () => {
    expect(AVATAR_LIMITS.maxSide).toBeLessThanOrEqual(1024);
    expect(AVATAR_LIMITS.maxBytes).toBeLessThan(3_000_000);
  });

  it.each([
    ['quota_exceeded', 'avatar.errors.quota'],
    ['ai_not_configured', 'avatar.errors.notConfigured'],
    ['ai_timeout', 'avatar.errors.timeout'],
    ['ai_refused', 'avatar.errors.refused'],
    ['avatar_not_allowed', 'avatar.errors.notAllowed'],
    ['forbidden', 'avatar.errors.notAllowed'],
    ['file_too_large', 'avatar.errors.tooLarge'],
    ['tooLarge', 'avatar.errors.tooLarge'],
    ['unsupported_type', 'avatar.errors.unsupportedType'],
    ['network', 'avatar.errors.network'],
    ['unreadable', 'avatar.errors.unreadable'],
    ['no_candidate', 'avatar.errors.generic'],
    ['quelque chose d’inconnu', 'avatar.errors.generic'],
    ['', 'avatar.errors.generic'],
  ])('erreur « %s » → %s', (code, key) => {
    expect(avatarErrorKey(code)).toBe(key);
  });
});

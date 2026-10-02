import { shouldResetCache } from './cache-owner';

describe('shouldResetCache', () => {
  it('premier lancement : rien à purger', () => expect(shouldResetCache(null, null)).toBe(false));
  it('même utilisateur : on garde le cache', () => expect(shouldResetCache('u1', 'u1')).toBe(false));
  it('autre utilisateur : purge', () => expect(shouldResetCache('u1', 'u2')).toBe(true));
  it('déconnexion : purge', () => expect(shouldResetCache('u1', null)).toBe(true));
});

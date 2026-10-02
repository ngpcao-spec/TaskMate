import { resolveEntryRoute, type EntryState } from './entry-route';

const base: EntryState = { authReady: true, hasSession: true, memberLoaded: true, member: null, childrenCount: 0 };

describe('resolveEntryRoute', () => {
  it('attend la lecture de la session', () => {
    expect(resolveEntryRoute({ ...base, authReady: false })).toBe('loading');
  });
  it('envoie un visiteur sans session vers le choix du rôle', () => {
    expect(resolveEntryRoute({ ...base, hasSession: false })).toBe('/onboarding/role');
  });
  it('attend le chargement du membership', () => {
    expect(resolveEntryRoute({ ...base, memberLoaded: false })).toBe('loading');
  });
  it('envoie un compte sans famille vers la création/jointure', () => {
    expect(resolveEntryRoute(base)).toBe('/onboarding/family');
  });
  it('envoie un parent sans enfant vers la création des profils', () => {
    expect(resolveEntryRoute({ ...base, member: { role: 'parent' } })).toBe('/onboarding/children');
  });
  it('ouvre l’accueil pour un parent avec enfants', () => {
    expect(resolveEntryRoute({ ...base, member: { role: 'parent' }, childrenCount: 2 })).toBe('/(tabs)/today');
  });
  it('ouvre l’accueil pour un enfant, même sans compter les enfants', () => {
    expect(resolveEntryRoute({ ...base, member: { role: 'child' } })).toBe('/(tabs)/today');
  });
});

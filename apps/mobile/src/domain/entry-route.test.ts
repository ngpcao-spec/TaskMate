import { ME_STALE_MS, meSettled, meStaleTime, resolveEntryRoute, type EntryState } from './entry-route';

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
  it('renvoie un compte enfant sans profil à la connexion enfant (jamais de création de famille)', () => {
    expect(resolveEntryRoute({ ...base, isChildAccount: true })).toBe('/onboarding/child-login');
  });
  it('envoie un parent sans enfant vers la création des profils', () => {
    expect(resolveEntryRoute({ ...base, member: { role: 'parent' } })).toBe('/onboarding/setup');
  });
  it('ouvre l’accueil pour un parent avec enfants', () => {
    expect(resolveEntryRoute({ ...base, member: { role: 'parent' }, childrenCount: 2 })).toBe('/(tabs)/today');
  });
  it('ouvre l’accueil pour un enfant, même sans compter les enfants', () => {
    expect(resolveEntryRoute({ ...base, member: { role: 'child' } })).toBe('/(tabs)/today');
  });
});

describe('cache persisté et « aucun enfant » (D-090)', () => {
  it('« aucun enfant » est toujours périmé (relu à chaque montage) ; sinon la fraîcheur habituelle', () => {
    expect(meStaleTime(0)).toBe(0);
    expect(meStaleTime(1)).toBe(ME_STALE_MS);
    expect(meStaleTime(3)).toBe(ME_STALE_MS);
    expect(meStaleTime(undefined)).toBe(ME_STALE_MS); // pas encore de donnée
  });
  it('zéro enfant pendant une relecture : le routage attend (pas de retour dans l\'assistant sur une donnée d\'avant la création de l\'enfant)', () => {
    expect(meSettled(false, 0, true)).toBe(false);
    expect(meSettled(false, 0, false)).toBe(true); // relu : c\'est bien une famille neuve
    expect(meSettled(false, 2, true)).toBe(true); // des enfants : inutile d\'attendre
    expect(meSettled(true, 0, true)).toBe(false); // rien encore
    expect(meSettled(true, 0, false)).toBe(false);
  });
});

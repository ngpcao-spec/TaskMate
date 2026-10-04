export type EntryMember = { role: 'parent' | 'child' };

export type EntryState = {
  /** La session auth a été lue depuis le stockage. */
  authReady: boolean;
  hasSession: boolean;
  /** Le membership a fini de se charger (n'a de sens que si hasSession). */
  memberLoaded: boolean;
  member: EntryMember | null;
  childrenCount: number;
  /** Compte enfant (app_metadata.account_type = 'child') dont le profil a été retiré : jamais de création de famille. */
  isChildAccount?: boolean;
};

export type EntryRoute =
  | 'loading'
  | '/onboarding/role'
  | '/onboarding/family'
  | '/onboarding/child-login'
  | '/onboarding/children'
  | '/(tabs)/today';

/** Où envoyer l'utilisateur au lancement, selon session et rôle (SPEC §2.1). */
export function resolveEntryRoute(s: EntryState): EntryRoute {
  if (!s.authReady) return 'loading';
  if (!s.hasSession) return '/onboarding/role';
  if (!s.memberLoaded) return 'loading';
  // Compte sans membership : un parent crée sa famille ; un compte enfant supprimé/retiré retourne à la connexion enfant.
  if (!s.member) return s.isChildAccount ? '/onboarding/child-login' : '/onboarding/family';
  if (s.member.role === 'parent' && s.childrenCount === 0) return '/onboarding/children';
  return '/(tabs)/today';
}

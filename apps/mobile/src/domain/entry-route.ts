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
  | '/onboarding/setup'
  | '/(tabs)/today';

/** Où envoyer l'utilisateur au lancement, selon session et rôle (SPEC §2.1). */
export function resolveEntryRoute(s: EntryState): EntryRoute {
  if (!s.authReady) return 'loading';
  if (!s.hasSession) return '/onboarding/role';
  if (!s.memberLoaded) return 'loading';
  // Compte sans membership : un parent crée sa famille ; un compte enfant supprimé/retiré retourne à la connexion enfant.
  if (!s.member) return s.isChildAccount ? '/onboarding/child-login' : '/onboarding/family';
  // famille NEUVE (aucun enfant) : l'assistant de première connexion (D-090) ; une famille existante n'y est jamais envoyée automatiquement
  if (s.member.role === 'parent' && s.childrenCount === 0) return '/onboarding/setup';
  return '/(tabs)/today';
}

/** Durée de fraîcheur de `me` (identique au défaut du client de requêtes). */
export const ME_STALE_MS = 30_000;

/**
 * Un « aucun enfant » peut venir du cache persisté, écrit AVANT la création du premier enfant (rechargement de la page juste après). On ne s'y fie pas :
 * ce résultat-là est toujours périmé (relu à chaque montage). Sinon le parent retournerait dans l'assistant alors que son enfant existe.
 */
export const meStaleTime = (childrenCount: number | undefined): number => (childrenCount === 0 ? 0 : ME_STALE_MS);

/** `me` est exploitable pour le routage : lu, et — s'il annonce zéro enfant — pas en cours de relecture. */
export const meSettled = (isPending: boolean, childrenCount: number, isFetching: boolean): boolean => !isPending && !(childrenCount === 0 && isFetching);

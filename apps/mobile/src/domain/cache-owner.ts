/**
 * Faut-il purger le cache persisté ? Oui si la session change de propriétaire, ou à la déconnexion
 * (jamais de données d'un compte visibles par un autre). Sans session au tout premier lancement : rien à purger.
 */
export function shouldResetCache(lastUserId: string | null, currentUserId: string | null): boolean {
  if (lastUserId === null) return false;
  return lastUserId !== currentUserId;
}

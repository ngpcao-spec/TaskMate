/** Domaine des adresses INTERNES des comptes enfants (D-051) : jamais affichées, jamais copiées. */
export const INTERNAL_CHILD_EMAIL_DOMAIN = '@child.taskmate.invalid';

/**
 * E-mail de connexion à montrer à un PARENT (celui de sa session, aucun appel réseau) ; null s'il est absent ou s'il s'agit d'une adresse interne d'un compte enfant
 * (défense en profondeur : un compte enfant ne voit de toute façon jamais cet écran).
 */
export function parentLoginEmail(email: string | null | undefined): string | null {
  const e = email?.trim();
  if (!e || e.toLowerCase().endsWith(INTERNAL_CHILD_EMAIL_DOMAIN)) return null;
  return e;
}

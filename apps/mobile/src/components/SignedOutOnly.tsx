import type { ReactNode } from 'react';
import { useSessionStore } from '@/store/session';

/**
 * Écrans de connexion : n'existent que sans session. Dès que l'utilisateur est connecté, leurs champs (e-mail, identifiant, mot de passe) sont DÉMONTÉS,
 * même si l'écran reste dans la pile de navigation (D-093).
 */
export function SignedOutOnly({ children }: { children: ReactNode }) {
  const signedIn = useSessionStore((s) => s.session !== null);
  return signedIn ? null : <>{children}</>;
}

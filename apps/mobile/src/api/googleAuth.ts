import { AuthFlowError } from './auth';

/** Natif : la connexion Google passe par le web (cible principale, D-025) ; l'application native n'a pas encore de retour d'OAuth. */
export async function startGoogleSignIn(): Promise<void> {
  throw new AuthFlowError('googleUnavailable');
}

import type { AuthError } from '@supabase/supabase-js';
import { supabase } from './supabase';

/** Cause d'un échec de connexion, traduite en message par l'écran. */
export type AuthFailure = 'invalidCredentials' | 'tooManyAttempts' | 'googleUnavailable' | 'network' | 'rateLimited' | 'unknown';

export class AuthFlowError extends Error {
  constructor(readonly kind: AuthFailure) {
    super(kind);
    this.name = 'AuthFlowError';
  }
}

export function classifyAuthError(error: Pick<AuthError, 'code' | 'status' | 'message'>): AuthFailure {
  switch (error.code) {
    case 'invalid_credentials':
    case 'email_not_confirmed':
      return 'invalidCredentials';
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'rateLimited';
  }
  if (error.status === 0 || error.status === undefined || /fetch|network/i.test(error.message)) return 'network';
  return 'unknown';
}

/** Connexion d'un parent HISTORIQUE (e-mail + mot de passe). Aucune inscription par e-mail : un nouveau parent se connecte avec Google. */
export async function signInParent(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new AuthFlowError(classifyAuthError(error));
}

type ChildLoginResponse = { session?: { access_token: string; refresh_token: string } };

/**
 * Connexion d'un enfant : e-mail d'un parent de la famille + identifiant + mot de passe, via l'Edge Function `child-login`
 * (verrouillage par IP et par famille ; réponse d'échec identique quel que soit le champ faux).
 */
export async function signInChild(parentEmail: string, loginId: string, password: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke<ChildLoginResponse>('child-login', {
    body: { parentEmail: parentEmail.trim(), loginId, password },
  });
  if (error) {
    const response = (error as { context?: Response }).context;
    if (!response || typeof response.status !== 'number') throw new AuthFlowError('network');
    throw new AuthFlowError(response.status === 429 ? 'tooManyAttempts' : response.status === 401 ? 'invalidCredentials' : 'unknown');
  }
  const session = data?.session;
  if (!session) throw new AuthFlowError('invalidCredentials');
  const { error: sessionError } = await supabase.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
  if (sessionError) throw new AuthFlowError('unknown');
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

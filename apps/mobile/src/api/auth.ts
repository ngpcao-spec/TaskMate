import type { AuthError } from '@supabase/supabase-js';
import { loginEmail, normalizeLoginId } from '@/domain/child-account';
import { supabase } from './supabase';

/** Cause d'un échec de connexion/inscription, traduite en message par l'écran. */
export type AuthFailure = 'invalidCredentials' | 'alreadyExists' | 'weakPassword' | 'confirmEmailOn' | 'rateLimited' | 'network' | 'unknown';

export class AuthFlowError extends Error {
  constructor(readonly kind: AuthFailure) {
    super(kind);
    this.name = 'AuthFlowError';
  }
}

export function classifyAuthError(error: Pick<AuthError, 'code' | 'status' | 'message'>): AuthFailure {
  switch (error.code) {
    case 'invalid_credentials':
      return 'invalidCredentials';
    case 'user_already_exists':
    case 'email_exists':
      return 'alreadyExists';
    case 'weak_password':
      return 'weakPassword';
    case 'email_not_confirmed':
      return 'confirmEmailOn';
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'rateLimited';
  }
  if (error.status === 0 || error.status === undefined || /fetch|network/i.test(error.message)) return 'network';
  return 'unknown';
}

/** Inscription du parent (e-mail + mot de passe). « Confirm email » doit être désactivé côté Supabase : aucune session = il ne l'est pas. */
export async function signUpParent(email: string, password: string): Promise<void> {
  const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
  if (error) throw new AuthFlowError(classifyAuthError(error));
  if (!data.session) throw new AuthFlowError('confirmEmailOn');
}

export async function signInParent(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new AuthFlowError(classifyAuthError(error));
}

/** Connexion d'un enfant : identifiant + mot de passe (l'adresse fictive est dérivée, jamais affichée). */
export async function signInChild(loginId: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email: loginEmail(normalizeLoginId(loginId)), password });
  if (error) throw new AuthFlowError(classifyAuthError(error));
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/** Règles des comptes (SPEC v4 + changement produit : e-mail/mot de passe pour les parents, identifiant/mot de passe pour les enfants). */

export const PARENT_PASSWORD_MIN = 8;
export const CHILD_PASSWORD_MIN = 6;
/** Limite bcrypt de l'authentification Supabase (octets). */
export const PASSWORD_MAX_BYTES = 72;

export const LOGIN_ID_MIN = 3;
export const LOGIN_ID_MAX = 30;
/** Miroir exact de `supabase/functions/_shared/child-accounts.ts` et de la contrainte SQL de `child_accounts.login_id` (test de parité). */
export const LOGIN_ID_REGEX = /^[a-z0-9][a-z0-9._-]{2,29}$/;

/** Identifiant saisi → forme canonique : minuscules, sans accents (« Nguyễn Đức » → « nguyen duc » avant filtrage), sans espaces autour. */
export function normalizeLoginId(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd');
}

export type LoginIdError = 'required' | 'tooShort' | 'tooLong' | 'invalidChars' | 'invalidStart';

export function validateLoginId(raw: string): LoginIdError | null {
  const id = normalizeLoginId(raw);
  if (id === '') return 'required';
  if (id.length < LOGIN_ID_MIN) return 'tooShort';
  if (id.length > LOGIN_ID_MAX) return 'tooLong';
  if (!/^[a-z0-9._-]+$/.test(id)) return 'invalidChars';
  if (!/^[a-z0-9]/.test(id)) return 'invalidStart';
  return null;
}

export type PasswordError = 'required' | 'tooShort' | 'tooLong';

export function validatePassword(password: string, min: number): PasswordError | null {
  if (password === '') return 'required';
  if (password.length < min) return 'tooShort';
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) return 'tooLong';
  return null;
}

export const validateParentPassword = (password: string) => validatePassword(password, PARENT_PASSWORD_MIN);
export const validateChildPassword = (password: string) => validatePassword(password, CHILD_PASSWORD_MIN);

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isValidEmail = (email: string): boolean => EMAIL_RE.test(email.trim());

/** Codes d'erreur renvoyés par les Edge Functions de comptes enfants. */
export type ChildAccountErrorCode =
  | 'identifier_taken'
  | 'invalid_identifier'
  | 'weak_password'
  | 'account_exists'
  | 'no_account'
  | 'forbidden'
  | 'not_authenticated'
  | 'server_error';

const KNOWN: readonly string[] = ['identifier_taken', 'invalid_identifier', 'weak_password', 'account_exists', 'no_account', 'forbidden', 'not_authenticated', 'server_error'];
export const toChildAccountError = (value: unknown): ChildAccountErrorCode => (typeof value === 'string' && KNOWN.includes(value) ? (value as ChildAccountErrorCode) : 'server_error');

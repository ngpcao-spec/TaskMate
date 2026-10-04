// Logique pure des comptes enfants (SANS API Deno ni import : testable avec Jest, câblée par child-accounts-runtime.ts).
// Principe : l'appelant est d'abord autorisé côté serveur (RPC `child_account_target`, exécutée avec SON jeton : il doit être
// PARENT de la famille de l'enfant) ; seulement ensuite, la clé service — fournie par l'environnement des fonctions, jamais
// écrite dans le code — crée / modifie / verrouille le compte auth.

// ───────────── règles (miroir de apps/mobile/src/domain/child-account.ts, vérifié par un test de parité) ─────────────
export const LOGIN_ID_REGEX = /^[a-z0-9][a-z0-9._-]{2,29}$/;
export const CHILD_PASSWORD_MIN = 6;
export const PASSWORD_MAX = 72; // limite bcrypt de GoTrue
/** Domaine réservé (RFC 2606) : l'adresse fictive ne peut jamais recevoir de courrier. */
export const CHILD_EMAIL_DOMAIN = 'child.taskmate.invalid';

export function normalizeLoginId(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd');
}
export const isValidLoginId = (loginId: string): boolean => LOGIN_ID_REGEX.test(loginId);
export const loginEmail = (loginId: string): string => `${loginId}@${CHILD_EMAIL_DOMAIN}`;
export const tombstoneEmail = (userId: string): string => `deleted-${userId}@${CHILD_EMAIL_DOMAIN}`;
export const isValidPassword = (password: unknown): password is string =>
  typeof password === 'string' && password.length >= CHILD_PASSWORD_MIN && new TextEncoder().encode(password).length <= PASSWORD_MAX;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID_RE.test(value);

// ───────────── dépendances injectées ─────────────
export type Target = {
  family_id: string;
  child_id: string;
  child_name: string;
  member_id: string | null;
  login_id: string | null;
  user_id: string | null;
};
type DbError = { code?: string; message?: string } | null;

export type ChildAccountDeps = {
  /** RPC `child_account_target` avec le JWT de l'appelant (autorisation côté serveur). */
  target: (childId: string) => Promise<{ data: Target | null; error: DbError }>;
  /** Crée le compte auth (clé service) : e-mail fictif, mot de passe, marqueur app_metadata.account_type = 'child'. */
  createUser: (email: string, password: string) => Promise<{ userId: string | null; error: 'email_exists' | 'weak_password' | 'other' | null }>;
  /** Supprime un compte tout juste créé (annulation). */
  deleteUser: (userId: string) => Promise<void>;
  /** RPC `register_child_account` (service_role). */
  register: (childId: string, userId: string, loginId: string) => Promise<{ error: DbError }>;
  /** RPC `remove_child_account` (service_role) : renvoie le user_id auth. */
  remove: (childId: string) => Promise<{ userId: string | null; error: DbError }>;
  setPassword: (userId: string, password: string) => Promise<{ error: boolean }>;
  /** Verrouille le compte : e-mail fictif libéré, mot de passe aléatoire, connexion bannie. */
  lockUser: (userId: string, tombstone: string, randomPassword: string) => Promise<{ error: boolean }>;
  /** Retire le profil enfant (suppression douce) avec le jeton de l'appelant (RLS parent). */
  softDeleteProfile: (childId: string) => Promise<{ error: boolean }>;
  randomPassword: () => string;
};

export type Outcome = { status: number; body: Record<string, unknown> };
const fail = (status: number, error: string): Outcome => ({ status, body: { error } });

type Authorized = { ok: true; target: Target } | { ok: false; outcome: Outcome };

/** Étape 1 de toute opération : l'appelant doit être parent de la famille de cet enfant (sinon 403, sans rien révéler). */
async function authorize(deps: ChildAccountDeps, childId: unknown): Promise<Authorized> {
  if (!isUuid(childId)) return { ok: false, outcome: fail(422, 'invalid_child') };
  const { data, error } = await deps.target(childId);
  if (error) {
    if (error.code === '42501') return { ok: false, outcome: fail(403, 'forbidden') };
    if (error.code === '28000') return { ok: false, outcome: fail(401, 'not_authenticated') };
    return { ok: false, outcome: fail(500, 'server_error') };
  }
  if (!data) return { ok: false, outcome: fail(403, 'forbidden') };
  return { ok: true, target: data };
}

const asRecord = (body: unknown): Record<string, unknown> => (typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {});

// ───────────── create-child ─────────────
export async function createChildAccount(deps: ChildAccountDeps, rawBody: unknown): Promise<Outcome> {
  const body = asRecord(rawBody);
  const auth = await authorize(deps, body.childId);
  if (!auth.ok) return auth.outcome;
  const loginId = typeof body.loginId === 'string' ? normalizeLoginId(body.loginId) : '';
  if (!isValidLoginId(loginId)) return fail(422, 'invalid_identifier');
  if (!isValidPassword(body.password)) return fail(422, 'weak_password');
  if (auth.target.login_id !== null) return fail(409, 'account_exists');

  const created = await deps.createUser(loginEmail(loginId), body.password);
  if (created.error === 'email_exists') return fail(409, 'identifier_taken');
  if (created.error === 'weak_password') return fail(422, 'weak_password');
  if (created.error || !created.userId) return fail(500, 'server_error');

  const registered = await deps.register(auth.target.child_id, created.userId, loginId);
  if (registered.error) {
    await deps.deleteUser(created.userId); // pas de compte orphelin
    const message = registered.error.message ?? '';
    if (message.includes('identifier_taken')) return fail(409, 'identifier_taken');
    if (message.includes('account_exists')) return fail(409, 'account_exists');
    return fail(500, 'server_error');
  }
  return { status: 200, body: { loginId } };
}

// ───────────── reset-child-password ─────────────
export async function resetChildPassword(deps: ChildAccountDeps, rawBody: unknown): Promise<Outcome> {
  const body = asRecord(rawBody);
  const auth = await authorize(deps, body.childId);
  if (!auth.ok) return auth.outcome;
  if (!auth.target.user_id) return fail(404, 'no_account');
  if (!isValidPassword(body.password)) return fail(422, 'weak_password');
  const { error } = await deps.setPassword(auth.target.user_id, body.password);
  return error ? fail(500, 'server_error') : { status: 200, body: { ok: true } };
}

// ───────────── delete-child ─────────────
/** Supprime le COMPTE de l'enfant (connexion impossible, identifiant libéré) ; `deleteProfile` retire aussi le profil. */
export async function deleteChildAccount(deps: ChildAccountDeps, rawBody: unknown): Promise<Outcome> {
  const body = asRecord(rawBody);
  const auth = await authorize(deps, body.childId);
  if (!auth.ok) return auth.outcome;
  const deleteProfile = body.deleteProfile === true;
  if (!auth.target.user_id && !deleteProfile) return fail(404, 'no_account');

  if (auth.target.user_id) {
    // 1) verrouiller le compte auth (rejouable) ; 2) retirer le lien côté base
    const locked = await deps.lockUser(auth.target.user_id, tombstoneEmail(auth.target.user_id), deps.randomPassword());
    if (locked.error) return fail(500, 'server_error');
    const removed = await deps.remove(auth.target.child_id);
    if (removed.error) return fail(500, 'server_error');
  }
  if (deleteProfile) {
    const { error } = await deps.softDeleteProfile(auth.target.child_id);
    if (error) return fail(500, 'server_error');
  }
  return { status: 200, body: { deleted: true } };
}

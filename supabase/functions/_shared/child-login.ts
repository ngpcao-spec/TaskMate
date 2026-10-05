// Logique pure de la connexion enfant (SANS API Deno ni import : testable avec Jest, câblée par child-login/index.ts).
// Formulaire : e-mail d'un parent de la famille + identifiant de l'enfant + mot de passe.
// Garanties : (1) réponse d'échec IDENTIQUE quel que soit le champ faux (aucune énumération d'e-mails ni d'identifiants) ;
// (2) verrouillage temporaire par IP et par famille, décidé AVANT toute vérification de mot de passe ;
// (3) le mot de passe de l'enfant n'est connu QUE de la base (haché bcrypt, RPC service_role) : GoTrue, lui, a un mot de passe
// aléatoire inconnu de tous et une adresse UUID ; la session est émise par GoTrue pour l'adresse interne seulement APRÈS cette
// vérification. Il n'existe donc aucune autre porte d'entrée (D-051).

export const INVALID_CREDENTIALS = 'invalid_credentials';
export const TOO_MANY_ATTEMPTS = 'too_many_attempts';

export type Outcome = { status: number; body: Record<string, unknown> };

export type LoginPlan = { locked: boolean; family_key: string; ip_key: string; auth_email: string | null };
type Session = { access_token: string; refresh_token: string; expires_in: number; expires_at?: number; token_type: string };

export type ChildLoginDeps = {
  /** RPC `child_login_prepare` (service_role) : verrou + résolution (e-mail de parent, identifiant) → adresse du compte. */
  prepare: (ip: string, parentEmail: string, loginId: string) => Promise<{ data: LoginPlan | null; error: boolean }>;
  /** RPC `child_login_record_failure` (service_role). */
  recordFailure: (ipKey: string, familyKey: string) => Promise<void>;
  /** RPC `child_login_check_password` (service_role) : le mot de passe correspond-il au haché de ce compte ? (coût constant) */
  checkPassword: (authEmail: string, password: string) => Promise<{ ok: boolean; error: boolean }>;
  /** Émet une session GoTrue pour l'adresse interne (lien magique généré côté serveur puis échangé) : réservé à ce flux. */
  mintSession: (authEmail: string) => Promise<{ session: Session | null }>;
};

const fail = (status: number, error: string): Outcome => ({ status, body: { error } });
/** Une seule réponse pour tout échec d'identification (champ manquant, e-mail, identifiant ou mot de passe faux). */
const invalid = (): Outcome => fail(401, INVALID_CREDENTIALS);

const MAX = 200;
const asText = (value: unknown): string => (typeof value === 'string' ? value.trim().slice(0, MAX) : '');
/** Même normalisation que le client (apps/mobile/src/domain/child-account.ts) : minuscules, sans accents. */
export const normalizeLoginId = (raw: string): string =>
  raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd');

export async function childLogin(deps: ChildLoginDeps, ip: string, rawBody: unknown): Promise<Outcome> {
  const body = typeof rawBody === 'object' && rawBody !== null ? (rawBody as Record<string, unknown>) : {};
  const parentEmail = asText(body.parentEmail).toLowerCase();
  const loginId = normalizeLoginId(asText(body.loginId));
  const password = typeof body.password === 'string' ? body.password.slice(0, 200) : '';

  // L'étape de verrou/journalisation s'exécute MÊME si un champ manque : pas de différence observable.
  const { data: plan, error } = await deps.prepare(ip, parentEmail, loginId);
  if (error || !plan) return fail(500, 'server_error');
  if (plan.locked) return fail(429, TOO_MANY_ATTEMPTS);

  if (!plan.auth_email || parentEmail === '' || loginId === '' || password === '') {
    await deps.recordFailure(plan.ip_key, plan.family_key);
    return invalid();
  }
  const checked = await deps.checkPassword(plan.auth_email, password);
  if (checked.error) return fail(500, 'server_error');
  if (!checked.ok) {
    await deps.recordFailure(plan.ip_key, plan.family_key);
    return invalid();
  }
  // identifiants corrects : l'émission de la session ne dépend plus d'aucun mot de passe GoTrue
  const { session } = await deps.mintSession(plan.auth_email);
  if (!session) return fail(500, 'server_error');
  return {
    status: 200,
    body: { session: { access_token: session.access_token, refresh_token: session.refresh_token, expires_in: session.expires_in, token_type: session.token_type } },
  };
}

/**
 * IP de l'appelant : en-tête posé par le CDN (cf-connecting-ip), sinon premier élément de x-forwarded-for, sinon x-real-ip.
 * x-forwarded-for pouvant être renseigné par l'appelant, le verrouillage PAR FAMILLE (20 échecs / 15 min, indépendant de l'IP)
 * reste le garde-fou contre un contournement de la limite par IP.
 */
export function clientIp(headers: { get(name: string): string | null }): string {
  const cdn = headers.get('cf-connecting-ip')?.trim();
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return cdn || forwarded || headers.get('x-real-ip')?.trim() || 'unknown';
}

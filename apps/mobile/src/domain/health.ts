import type { Database } from '@/types/db';
import { REALTIME_TABLES } from './realtime';

/** Logique pure du diagnostic de production (Réglages → Diagnostic) : ce que le serveur DOIT exposer et comment l'évaluer. */

type DbTable = keyof Database['public']['Tables'];
type DbFunction = keyof Database['public']['Functions'];

export const EXPECTED_TABLES = [
  'activity_log',
  'auth_attempts',
  'child_accounts',
  'children',
  'devices',
  'families',
  'goals',
  'members',
  'notification_prefs',
  'parent_invites',
  'point_transactions',
  'recurrences',
  'reward_requests',
  'rewards',
  'tasks',
] as const satisfies readonly DbTable[];

export const EXPECTED_FUNCTIONS = [
  'adjust_points',
  'approve_reward_request',
  'cancel_reward_request',
  'child_account_target',
  'child_balance',
  'child_login_check_password',
  'child_login_prepare',
  'child_login_record_failure',
  'child_pending_task_points',
  'child_reserved',
  'complete_task',
  'create_family',
  'create_parent_invite',
  'delete_family',
  'diagnostics',
  'expire_reward_requests',
  'family_today',
  'generate_all_recurrences',
  'generate_recurrence',
  'is_google_account',
  'is_parent',
  'join_family_with_code',
  'leave_family',
  'log_activity',
  'migrate_legacy_child_accounts',
  'my_child_id',
  'my_family_id',
  'my_member_id',
  'my_role',
  'recurrence_matches',
  'register_child_account',
  'register_device',
  'register_web_push',
  'reject_reward_request',
  'remove_child_account',
  'reject_task',
  'request_reward',
  'require_member',
  'revoke_device',
  'revoke_parent_invite',
  'schedule_cron_jobs',
  'set_child_password',
  'sync_recurrence',
  'uncomplete_task',
  'unregister_web_push',
  'validate_task',
] as const satisfies readonly DbFunction[];

// Garde de complétude à la compilation : ajouter une table ou une RPC dans les types générés sans l'ajouter ici ne compile plus.
type NotListedTable = Exclude<DbTable, (typeof EXPECTED_TABLES)[number]>;
type NotListedFunction = Exclude<DbFunction, (typeof EXPECTED_FUNCTIONS)[number]>;
export const COMPLETENESS: [NotListedTable, NotListedFunction] extends [never, never] ? true : never = true;

export const EXPECTED_CRON_JOBS = ['expire-reward-requests', 'generate-recurrences'] as const;
export const EDGE_FUNCTIONS = ['child-login', 'create-child', 'reset-child-password', 'delete-child', 'delete-account', 'send-push'] as const;
export type EdgeFunctionName = (typeof EDGE_FUNCTIONS)[number];

export type DiagnosticsData = {
  tables: string[];
  tables_without_rls: string[];
  functions: string[];
  realtime_tables: string[];
  extensions: string[];
  cron_jobs: string[] | null;
};

const isStrings = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');

/** Valide la réponse de la RPC `diagnostics` (jamais de confiance aveugle : un serveur mal configuré peut renvoyer n'importe quoi). */
export function parseDiagnostics(raw: unknown): DiagnosticsData | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (!isStrings(r.tables) || !isStrings(r.tables_without_rls) || !isStrings(r.functions) || !isStrings(r.realtime_tables) || !isStrings(r.extensions)) return null;
  if (r.cron_jobs !== null && !isStrings(r.cron_jobs)) return null;
  return { tables: r.tables, tables_without_rls: r.tables_without_rls, functions: r.functions, realtime_tables: r.realtime_tables, extensions: r.extensions, cron_jobs: r.cron_jobs };
}

export type RealtimeStatus = 'SUBSCRIBED' | 'TIMED_OUT' | 'CHANNEL_ERROR' | 'CLOSED' | 'UNKNOWN';

export type Probes = {
  /** L'API répond (GET /auth/v1/settings). */
  reachable: boolean;
  /** Réglages publics d'Auth ; null si illisibles. */
  /** `google` = fournisseur Google activé (inscription des parents) ; `email` = connexion e-mail/mot de passe (parents existants). */
  auth: { google: boolean; email: boolean } | null;
  /** Résultat de la RPC `diagnostics`. */
  diagnostics: { ok: true; data: DiagnosticsData } | { ok: false; reason: 'missing_rpc' | 'forbidden' | 'error' };
  realtime: RealtimeStatus;
  /** true = déployée, false = absente (404), null = non vérifiable depuis le navigateur. */
  functions: Record<EdgeFunctionName, boolean | null>;
};

export type Env = { supabaseUrl: string; webUrl: string; vapidPublicKey: string };

export type HealthStatus = 'ok' | 'warn' | 'fail';
export type HealthItem = { id: string; status: HealthStatus; messageKey: string; params?: Record<string, string> };

const missing = (expected: readonly string[], present: readonly string[]): string[] => expected.filter((x) => !present.includes(x));
const list = (items: readonly string[]): string => items.join(', ');

/** Transforme les sondes en une liste de constats (clés i18n + paramètres) : ce qui va, ce qui manque, comment le corriger. */
export function evaluateHealth(p: Probes, env: Env): HealthItem[] {
  const out: HealthItem[] = [];
  const add = (id: string, status: HealthStatus, messageKey: string, params?: Record<string, string>) => out.push({ id, status, messageKey, params });

  // 1. connexion + configuration du front
  if (!p.reachable) add('connection', 'fail', 'health.connection.fail', { url: env.supabaseUrl });
  else add('connection', 'ok', 'health.connection.ok', { url: env.supabaseUrl });
  if (/^https?:\/\/(127\.0\.0\.1|localhost)/.test(env.supabaseUrl)) add('frontUrl', 'fail', 'health.frontUrl.local', { url: env.supabaseUrl });
  if (!env.webUrl) add('webUrl', 'warn', 'health.webUrl.missing');
  else add('webUrl', 'ok', 'health.webUrl.ok', { url: env.webUrl });

  // 2. Auth
  if (!p.auth) add('google', 'warn', 'health.google.unknown');
  else if (!p.auth.google) add('google', 'fail', 'health.google.disabled');
  else add('google', 'ok', 'health.google.ok');
  if (p.auth && !p.auth.email) add('email', 'fail', 'health.email.disabled');
  else if (p.auth) add('email', 'ok', 'health.email.ok');

  // 3. base de données (RPC diagnostics)
  const d = p.diagnostics;
  if (!d.ok) {
    if (d.reason === 'missing_rpc') add('migrations', 'fail', 'health.migrations.missingRpc');
    else if (d.reason === 'forbidden') add('migrations', 'warn', 'health.migrations.forbidden');
    else add('migrations', 'warn', 'health.migrations.error');
  } else {
    const data = d.data;
    const noTables = missing(EXPECTED_TABLES, data.tables);
    if (noTables.length > 0) add('tables', 'fail', 'health.tables.missing', { list: list(noTables) });
    else add('tables', 'ok', 'health.tables.ok', { count: String(EXPECTED_TABLES.length) });
    const noFns = missing(EXPECTED_FUNCTIONS, data.functions);
    if (noFns.length > 0) add('rpc', 'fail', 'health.rpc.missing', { list: list(noFns) });
    else add('rpc', 'ok', 'health.rpc.ok', { count: String(EXPECTED_FUNCTIONS.length) });
    if (data.tables_without_rls.length > 0) add('rls', 'fail', 'health.rls.disabled', { list: list(data.tables_without_rls) });
    else add('rls', 'ok', 'health.rls.ok');
    const noRealtime = missing(REALTIME_TABLES, data.realtime_tables);
    if (noRealtime.length > 0) add('publication', 'fail', 'health.publication.missing', { list: list(noRealtime) });
    else add('publication', 'ok', 'health.publication.ok');
    if (data.cron_jobs === null) add('cron', 'warn', 'health.cron.unknown');
    else {
      const noJobs = missing(EXPECTED_CRON_JOBS, data.cron_jobs);
      if (noJobs.length > 0) add('cron', 'warn', 'health.cron.missing', { list: list(noJobs) });
      else add('cron', 'ok', 'health.cron.ok');
    }
  }

  // 4. Realtime (connexion websocket)
  if (p.realtime === 'SUBSCRIBED') add('realtime', 'ok', 'health.realtime.ok');
  else add('realtime', 'fail', 'health.realtime.fail', { status: p.realtime });

  // 5. Edge Functions
  for (const name of EDGE_FUNCTIONS) {
    const deployed = p.functions[name];
    if (deployed === true) add(`fn-${name}`, 'ok', 'health.functions.ok', { name });
    else if (deployed === false) add(`fn-${name}`, 'fail', 'health.functions.missing', { name });
    else add(`fn-${name}`, 'warn', 'health.functions.unknown', { name });
  }

  // 6. Web Push (facultatif)
  if (!env.vapidPublicKey) add('vapid', 'warn', 'health.vapid.missing');
  else add('vapid', 'ok', 'health.vapid.ok');

  return out;
}

export type HealthSummary = { ok: number; warn: number; fail: number };
export const summarize = (items: readonly HealthItem[]): HealthSummary => ({
  ok: items.filter((i) => i.status === 'ok').length,
  warn: items.filter((i) => i.status === 'warn').length,
  fail: items.filter((i) => i.status === 'fail').length,
});

import type { Database } from '@/types/db';
import { REALTIME_TABLES } from './realtime';

/** Logique pure du diagnostic de production (Réglages → Diagnostic) : ce que le serveur DOIT exposer et comment l'évaluer. */

type DbTable = keyof Database['public']['Tables'];
type DbFunction = keyof Database['public']['Functions'];

export const EXPECTED_TABLES = [
  'activity_log',
  'ai_usage',
  'auth_attempts',
  'avatar_usage',
  'catalog_admin_log',
  'catalog_answer_keys',
  'catalog_questions',
  'catalog_quizzes',
  'child_accounts',
  'child_avatars',
  'child_subjects',
  'children',
  'devices',
  'families',
  'goals',
  'members',
  'notification_prefs',
  'onboarding_progress',
  'parent_invites',
  'platform_admins',
  'point_transactions',
  'quiz_answer_keys',
  'quiz_answers',
  'quiz_attempt_layouts',
  'quiz_attempt_progress',
  'quiz_attempts',
  'quiz_questions',
  'quiz_results',
  'quiz_sets',
  'recurrences',
  'reward_requests',
  'rewards',
  'tasks',
] as const satisfies readonly DbTable[];

export const EXPECTED_FUNCTIONS = [
  'adjust_points',
  'ai_finish',
  'ai_reserve',
  'ai_target',
  'ai_target_admin',
  'ai_usage_today',
  'approve_reward_request',
  'avatar_authorize',
  'avatar_finish',
  'avatar_reserve',
  'avatar_save_candidate',
  'avatar_target',
  'avatar_used_today',
  'cancel_reward_request',
  'catalog_check_slot',
  'catalog_confirm_answers',
  'catalog_create_quiz',
  'catalog_delete_question',
  'catalog_delete_quiz',
  'catalog_editable',
  'catalog_for_child',
  'catalog_get',
  'catalog_list',
  'catalog_make_layout',
  'catalog_new_attempt',
  'catalog_normalize_existing_grades',
  'catalog_normalize_grade',
  'catalog_purge_quiz',
  'catalog_questions_admin',
  'catalog_quiz_counts',
  'catalog_quiz_impact',
  'catalog_reorder_questions',
  'catalog_require_admin',
  'catalog_set_dates',
  'catalog_set_kind',
  'catalog_set_paper',
  'catalog_set_status',
  'catalog_upcoming_for_child',
  'catalog_update_info',
  'catalog_upsert_question',
  'child_account_target',
  'child_balance',
  'child_catalog_quizzes',
  'child_login_check_password',
  'child_login_prepare',
  'child_login_record_failure',
  'child_pending_task_points',
  'child_quiz_history',
  'child_quiz_progress',
  'child_quiz_questions',
  'child_quiz_result',
  'child_quiz_sets',
  'child_reserved',
  'complete_task',
  'confirm_child_avatar',
  'confirm_quiz_answers',
  'copy_quiz_set',
  'create_catalog_draft',
  'create_family',
  'create_parent_invite',
  'create_quiz_draft',
  'delete_family',
  'delete_quiz_question',
  'diagnostics',
  'discard_avatar_candidate',
  'expire_reward_requests',
  'family_today',
  'generate_all_recurrences',
  'generate_recurrence',
  'is_google_account',
  'is_parent',
  'is_platform_admin',
  'join_family_with_code',
  'leave_family',
  'log_activity',
  'migrate_legacy_child_accounts',
  'my_child_id',
  'my_family_id',
  'my_member_id',
  'my_push_status',
  'my_role',
  'onboarding_hide_card',
  'onboarding_require_parent',
  'onboarding_restart',
  'onboarding_set',
  'onboarding_state',
  'parent_attempt_review',
  'parent_catalog_attempts',
  'parent_catalog_overview',
  'parent_child_subjects',
  'parent_quiz_detail',
  'quiz_attempt_items',
  'quiz_choices_valid',
  'quiz_editable_set',
  'quiz_make_layout',
  'quiz_new_attempt',
  'quiz_points_for',
  'quiz_progress_counts',
  'quiz_require_child',
  'quiz_require_parent',
  'recurrence_matches',
  'register_child_account',
  'register_device',
  'register_web_push',
  'reject_reward_request',
  'reject_task',
  'relaunch_catalog_evaluation',
  'relaunch_quiz_evaluation',
  'remove_child_account',
  'remove_child_avatar',
  'reorder_quiz_questions',
  'request_reward',
  'require_member',
  'revoke_device',
  'revoke_parent_invite',
  'save_quiz_progress',
  'schedule_cron_jobs',
  'set_avatar_ai_allowed',
  'set_child_class',
  'set_child_password',
  'set_child_subject',
  'set_push_locale',
  'set_quiz_due_on',
  'set_quiz_material_kind',
  'set_quiz_paper_support',
  'set_quiz_status',
  'shift_child_subject',
  'start_catalog_evaluation',
  'start_quiz_evaluation',
  'submit_quiz_evaluation',
  'sync_recurrence',
  'uncomplete_task',
  'unregister_web_push',
  'upsert_quiz_question',
  'validate_quiz_attempt',
  'validate_task',
] as const satisfies readonly DbFunction[];

// Garde de complétude à la compilation : ajouter une table ou une RPC dans les types générés sans l'ajouter ici ne compile plus.
type NotListedTable = Exclude<DbTable, (typeof EXPECTED_TABLES)[number]>;
type NotListedFunction = Exclude<DbFunction, (typeof EXPECTED_FUNCTIONS)[number]>;
export const COMPLETENESS: [NotListedTable, NotListedFunction] extends [never, never] ? true : never = true;

export const EXPECTED_CRON_JOBS = ['expire-reward-requests', 'generate-recurrences', 'push-evening-recap', 'push-task-reminders'] as const;
export const EDGE_FUNCTIONS = ['child-login', 'create-child', 'reset-child-password', 'delete-child', 'delete-account', 'send-push', 'generate-questions', 'generate-avatar'] as const;
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
  /** État de l'IA (GET sur `generate-questions`, parents) ; null si non vérifiable. */
  ai: { configured: boolean; usedToday: number | null; dailyLimit: number | null } | null;
  /** État du serveur d'envoi (POST `send-push` mode `status`, D-088) : VAPID configurée (booléen), appareils actifs du membre, dernier envoi ; null si non vérifiable. */
  push: { vapidConfigured: boolean; activeDevices: number; lastPushAt: string | null; lastPushResult: string | null } | null;
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

  // 6. IA des révisions (facultative : sans clé, le reste de l'app fonctionne)
  if (!p.ai) add('ai', 'warn', 'health.ai.unknown');
  else if (!p.ai.configured) add('ai', 'warn', 'health.ai.notConfigured');
  else add('ai', 'ok', 'health.ai.ok', { used: String(p.ai.usedToday ?? '?'), limit: String(p.ai.dailyLimit ?? '?') });

  // 7. Web Push (facultatif)
  if (!env.vapidPublicKey) add('vapid', 'warn', 'health.vapid.missing');
  else add('vapid', 'ok', 'health.vapid.ok');

  // 8. Serveur d'envoi des notifications (D-088) : clés VAPID côté fonctions (booléen seulement), appareils actifs du membre, dernier envoi
  if (!p.push) add('push', 'warn', 'health.push.unknown');
  else if (!p.push.vapidConfigured) add('push', 'warn', 'health.push.noVapid');
  else if (p.push.activeDevices === 0) add('push', 'warn', 'health.push.noDevice');
  else add('push', 'ok', p.push.lastPushResult ? 'health.push.okLast' : 'health.push.ok', { count: String(p.push.activeDevices), result: p.push.lastPushResult ?? '', at: p.push.lastPushAt ?? '' });

  return out;
}

export type HealthSummary = { ok: number; warn: number; fail: number };
export const summarize = (items: readonly HealthItem[]): HealthSummary => ({
  ok: items.filter((i) => i.status === 'ok').length,
  warn: items.filter((i) => i.status === 'warn').length,
  fail: items.filter((i) => i.status === 'fail').length,
});

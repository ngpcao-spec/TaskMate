import { webcrypto } from 'node:crypto';
import { COMPLETENESS, EDGE_FUNCTIONS, EXPECTED_FUNCTIONS, EXPECTED_TABLES, evaluateHealth, summarize, type DiagnosticsData, type Probes } from '@/domain/health';
import { REALTIME_TABLES } from '@/domain/realtime';
import { generateVapidKeys } from '@/domain/vapid';

const healthyData: DiagnosticsData = {
  tables: [...EXPECTED_TABLES],
  tables_without_rls: [],
  functions: [...EXPECTED_FUNCTIONS],
  realtime_tables: [...REALTIME_TABLES],
  extensions: ['pgcrypto', 'pg_cron'],
  cron_jobs: ['expire-reward-requests', 'generate-recurrences'],
};
const healthy: Probes = {
  reachable: true,
  auth: { google: true, email: true },
  diagnostics: { ok: true, data: healthyData },
  realtime: 'SUBSCRIBED',
  functions: { 'child-login': true, 'create-child': true, 'reset-child-password': true, 'delete-child': true, 'delete-account': true, 'send-push': true, 'generate-questions': true },
  ai: { configured: true, usedToday: 2, dailyLimit: 20 },
};
const env = { supabaseUrl: 'https://olftkozksanvnzlsvwrp.supabase.co', webUrl: 'https://taskmate-rho-nine.vercel.app', vapidPublicKey: 'KEY' };
const find = (items: ReturnType<typeof evaluateHealth>, id: string) => items.find((i) => i.id === id);

describe('diagnostic de production', () => {
  it('une installation complète n\'a ni alerte ni échec', () => {
    const items = evaluateHealth(healthy, env);
    expect(items.filter((i) => i.status !== 'ok')).toEqual([]);
    expect(summarize(items).fail).toBe(0);
  });

  it('les listes attendues couvrent exactement les types générés (garde de compilation) et les tables Realtime', () => {
    expect(COMPLETENESS).toBe(true);
    expect(EDGE_FUNCTIONS).toEqual(['child-login', 'create-child', 'reset-child-password', 'delete-child', 'delete-account', 'send-push', 'generate-questions']);
  });

  it('IA : configurée (usage du jour), non configurée (secret absent), inconnue', () => {
    expect(find(evaluateHealth(healthy, env), 'ai')).toMatchObject({ status: 'ok', messageKey: 'health.ai.ok', params: { used: '2', limit: '20' } });
    expect(find(evaluateHealth({ ...healthy, ai: { configured: false, usedToday: 0, dailyLimit: 20 } }, env), 'ai')).toMatchObject({ status: 'warn', messageKey: 'health.ai.notConfigured' });
    expect(find(evaluateHealth({ ...healthy, ai: null }, env), 'ai')).toMatchObject({ status: 'warn', messageKey: 'health.ai.unknown' });
    expect(find(evaluateHealth({ ...healthy, ai: { configured: true, usedToday: null, dailyLimit: null } }, env), 'ai')?.params).toEqual({ used: '?', limit: '?' });
    expect(find(evaluateHealth({ ...healthy, functions: { ...healthy.functions, 'generate-questions': false } }, env), 'fn-generate-questions')).toMatchObject({ status: 'fail' });
  });

  it('fournisseur Google désactivé : échec avec la consigne ; activé : OK', () => {
    const items = evaluateHealth({ ...healthy, auth: { google: false, email: true } }, env);
    expect(find(items, 'google')).toMatchObject({ status: 'fail', messageKey: 'health.google.disabled' });
    expect(find(evaluateHealth(healthy, env), 'google')?.status).toBe('ok');
  });

  it('API injoignable ou front pointé sur le local', () => {
    expect(find(evaluateHealth({ ...healthy, reachable: false }, env), 'connection')?.status).toBe('fail');
    expect(find(evaluateHealth(healthy, { ...env, supabaseUrl: 'http://127.0.0.1:54321' }), 'frontUrl')?.status).toBe('fail');
  });

  it('migrations non appliquées : la RPC diagnostics elle-même est absente', () => {
    const items = evaluateHealth({ ...healthy, diagnostics: { ok: false, reason: 'missing_rpc' } }, env);
    expect(find(items, 'migrations')).toMatchObject({ status: 'fail', messageKey: 'health.migrations.missingRpc' });
    expect(find(items, 'tables')).toBeUndefined();
  });

  it('liste ce qui manque : tables, RPC, RLS, publication Realtime, tâches cron', () => {
    const data: DiagnosticsData = {
      ...healthyData,
      tables: EXPECTED_TABLES.filter((t) => t !== 'goals' && t !== 'devices'),
      functions: EXPECTED_FUNCTIONS.filter((f) => f !== 'validate_task'),
      tables_without_rls: ['goals'],
      realtime_tables: ['tasks'],
      cron_jobs: ['expire-reward-requests'],
    };
    const items = evaluateHealth({ ...healthy, diagnostics: { ok: true, data } }, env);
    expect(find(items, 'tables')?.params?.list).toBe('devices, goals');
    expect(find(items, 'rpc')?.params?.list).toBe('validate_task');
    expect(find(items, 'rls')).toMatchObject({ status: 'fail', params: { list: 'goals' } });
    expect(find(items, 'publication')?.params?.list).toContain('reward_requests');
    expect(find(items, 'cron')).toMatchObject({ status: 'warn', params: { list: 'generate-recurrences' } });
  });

  it('cron inconnu (extension absente ou illisible) : avertissement, pas un échec', () => {
    const items = evaluateHealth({ ...healthy, diagnostics: { ok: true, data: { ...healthyData, cron_jobs: null } } }, env);
    expect(find(items, 'cron')).toMatchObject({ status: 'warn', messageKey: 'health.cron.unknown' });
  });

  it('Realtime, Edge Functions et Web Push', () => {
    const items = evaluateHealth(
      { ...healthy, realtime: 'TIMED_OUT', functions: { 'child-login': true, 'create-child': false, 'reset-child-password': true, 'delete-child': true, 'delete-account': null, 'send-push': true, 'generate-questions': true } },
      { ...env, vapidPublicKey: '', webUrl: '' },
    );
    expect(find(items, 'realtime')).toMatchObject({ status: 'fail', params: { status: 'TIMED_OUT' } });
    expect(find(items, 'fn-create-child')?.status).toBe('fail');
    expect(find(items, 'fn-delete-account')?.status).toBe('warn');
    expect(find(items, 'fn-send-push')?.status).toBe('ok');
    expect(find(items, 'vapid')?.status).toBe('warn');
    expect(find(items, 'webUrl')?.status).toBe('warn');
  });
});

describe('génération de clés VAPID', () => {
  it('produit une clé publique de 65 octets (0x04…) et une privée de 32 octets en base64url', async () => {
    const { publicKey, privateKey } = await generateVapidKeys(webcrypto.subtle as unknown as SubtleCrypto);
    const pub = Buffer.from(publicKey, 'base64url');
    expect(pub).toHaveLength(65);
    expect(pub[0]).toBe(4);
    expect(Buffer.from(privateKey, 'base64url')).toHaveLength(32);
    expect(publicKey).toMatch(/^[A-Za-z0-9_-]+$/);
    const other = await generateVapidKeys(webcrypto.subtle as unknown as SubtleCrypto);
    expect(other.privateKey).not.toBe(privateKey);
  });
});

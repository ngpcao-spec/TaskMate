import { config } from '@/config';
import { EDGE_FUNCTIONS, parseDiagnostics, type EdgeFunctionName, type Probes, type RealtimeStatus } from '@/domain/health';
import { supabase } from './supabase';

const TIMEOUT_MS = 8000;

export type ProbeDeps = {
  fetch: typeof fetch;
  supabaseUrl: string;
  anonKey: string;
  getAccessToken: () => Promise<string | null>;
  diagnostics: () => Promise<{ data: unknown; error: { code?: string; message?: string } | null }>;
  realtime: (timeoutMs: number) => Promise<RealtimeStatus>;
};

async function timedFetch(deps: ProbeDeps, url: string, init: RequestInit): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await deps.fetch(url, { ...init, signal: controller.signal });
  } catch {
    return null; // réseau coupé, CORS, délai dépassé
  } finally {
    clearTimeout(timer);
  }
}

/** Réglages publics d'Auth (aucun effet de bord : ne crée AUCUN utilisateur). */
async function authSettings(deps: ProbeDeps): Promise<{ reachable: boolean; auth: Probes['auth'] }> {
  const res = await timedFetch(deps, `${deps.supabaseUrl}/auth/v1/settings`, { headers: { apikey: deps.anonKey } });
  if (!res) return { reachable: false, auth: null };
  if (!res.ok) return { reachable: true, auth: null };
  try {
    const body = (await res.json()) as { external?: { email?: boolean }; mailer_autoconfirm?: boolean };
    return { reachable: true, auth: { autoconfirm: body.mailer_autoconfirm === true, email: body.external?.email === true } };
  } catch {
    return { reachable: true, auth: null };
  }
}

/** Une sonde qui ne répond jamais ne doit pas bloquer tout le diagnostic. */
const withTimeout = <T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> =>
  new Promise<T>((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });

async function diagnostics(deps: ProbeDeps): Promise<Probes['diagnostics']> {
  const { data, error } = await withTimeout(deps.diagnostics(), TIMEOUT_MS, { data: null, error: { code: 'TIMEOUT' } });
  if (error) {
    // PGRST202 / 42883 : la fonction n'existe pas → migrations pas appliquées ; 42501 : pas parent
    if (error.code === 'PGRST202' || error.code === '42883') return { ok: false, reason: 'missing_rpc' };
    if (error.code === '42501') return { ok: false, reason: 'forbidden' };
    return { ok: false, reason: 'error' };
  }
  const parsed = parseDiagnostics(data);
  return parsed ? { ok: true, data: parsed } : { ok: false, reason: 'error' };
}

/**
 * Une Edge Function absente répond 404. Un GET (jamais un POST authentifié : `delete-account` supprime la famille !) est
 * refusé par la fonction elle-même (405) ou par le contrôle de secret (401) : toute réponse ≠ 404 prouve le déploiement.
 */
async function functionDeployed(deps: ProbeDeps, name: EdgeFunctionName, token: string | null): Promise<boolean | null> {
  const res = await timedFetch(deps, `${deps.supabaseUrl}/functions/v1/${name}`, {
    method: 'GET',
    headers: { apikey: deps.anonKey, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!res) return null;
  return res.status !== 404;
}

export async function runProbes(deps: ProbeDeps): Promise<Probes> {
  const token = await deps.getAccessToken();
  const [settings, diag, realtime, ...fns] = await Promise.all([
    authSettings(deps),
    diagnostics(deps),
    deps.realtime(TIMEOUT_MS),
    ...EDGE_FUNCTIONS.map((name) => functionDeployed(deps, name, token)),
  ]);
  return {
    reachable: settings.reachable,
    auth: settings.auth,
    diagnostics: diag,
    realtime,
    functions: Object.fromEntries(EDGE_FUNCTIONS.map((name, i) => [name, fns[i]])) as Probes['functions'],
  };
}

/** Sondes réelles (client Supabase de l'app). */
export const liveProbeDeps = (): ProbeDeps => ({
  fetch: (...args) => fetch(...args),
  supabaseUrl: config.supabaseUrl,
  anonKey: config.supabaseAnonKey,
  getAccessToken: async () => (await supabase.auth.getSession()).data.session?.access_token ?? null,
  diagnostics: async () => {
    const { data, error } = await supabase.rpc('diagnostics');
    return { data, error };
  },
  realtime: (timeoutMs) =>
    new Promise<RealtimeStatus>((resolve) => {
      const channel = supabase.channel(`diagnostic-${Math.random().toString(36).slice(2, 8)}`);
      let settled = false;
      const done = (status: RealtimeStatus) => {
        if (settled) return; // removeChannel déclenche un statut CLOSED → sans garde, récursion infinie
        settled = true;
        clearTimeout(timer);
        void supabase.removeChannel(channel);
        resolve(status);
      };
      const timer = setTimeout(() => done('TIMED_OUT'), timeoutMs);
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED' || status === 'CHANNEL_ERROR' || status === 'CLOSED') done(status);
      });
    }),
});

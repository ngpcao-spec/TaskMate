import { runProbes, type ProbeDeps } from '@/api/health';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function deps(overrides: Partial<ProbeDeps> = {}, routes: Record<string, () => Response | Promise<Response>> = {}): ProbeDeps & { calls: { url: string; method: string; auth: string | null }[] } {
  const calls: { url: string; method: string; auth: string | null }[] = [];
  const base: ProbeDeps = {
    fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const headers = new Headers(init?.headers);
      calls.push({ url, method: init?.method ?? 'GET', auth: headers.get('Authorization') });
      const key = Object.keys(routes).find((k) => url.endsWith(k));
      const handler = key ? routes[key] : undefined;
      if (handler) return handler();
      if (url.endsWith('/auth/v1/settings')) return json({ external: { email: true, google: true } });
      return json({ error: 'method_not_allowed' }, 405);
    }) as typeof fetch,
    supabaseUrl: 'https://x.supabase.co',
    anonKey: 'anon',
    getAccessToken: async () => 'jwt-parent',
    diagnostics: async () => ({ data: { tables: [], tables_without_rls: [], functions: [], realtime_tables: [], extensions: [], cron_jobs: null }, error: null }),
    realtime: async () => 'SUBSCRIBED',
    ...overrides,
  };
  return Object.assign(base, { calls });
}

describe('sondes de diagnostic', () => {
  it('lit Auth sans créer d\'utilisateur et détecte les fonctions déployées (réponse ≠ 404)', async () => {
    const d = deps();
    const p = await runProbes(d);
    expect(p).toMatchObject({ reachable: true, auth: { google: true, email: true }, realtime: 'SUBSCRIBED' });
    expect(p.functions).toEqual({ 'child-login': true, 'create-child': true, 'reset-child-password': true, 'delete-child': true, 'delete-account': true, 'send-push': true });
    // jamais de POST : delete-account supprime la famille, signup créerait un utilisateur
    expect(d.calls.every((c) => c.method === 'GET')).toBe(true);
    expect(d.calls.filter((c) => c.url.includes('/functions/v1/')).every((c) => c.auth === 'Bearer jwt-parent')).toBe(true);
  });

  it('fonction absente = 404 ; réseau coupé = non vérifiable', async () => {
    const p = await runProbes(deps({}, { '/functions/v1/send-push': () => json({ code: 'NOT_FOUND' }, 404) }));
    expect(p.functions['send-push']).toBe(false);
    const down = await runProbes(deps({ fetch: (async () => { throw new TypeError('Failed to fetch'); }) as typeof fetch }));
    expect(down.reachable).toBe(false);
    expect(down.auth).toBeNull();
    expect(down.functions['create-child']).toBeNull();
  });

  it('external.google absent ou faux = Google désactivé', async () => {
    const p = await runProbes(deps({}, { '/auth/v1/settings': () => json({ external: { email: true } }) }));
    expect(p.auth).toEqual({ google: false, email: true });
  });

  it('classe les erreurs de la RPC diagnostics', async () => {
    const reason = async (code: string) => (await runProbes(deps({ diagnostics: async () => ({ data: null, error: { code } }) }))).diagnostics;
    expect(await reason('PGRST202')).toEqual({ ok: false, reason: 'missing_rpc' });
    expect(await reason('42883')).toEqual({ ok: false, reason: 'missing_rpc' });
    expect(await reason('42501')).toEqual({ ok: false, reason: 'forbidden' });
    expect(await reason('XX000')).toEqual({ ok: false, reason: 'error' });
  });

  it('une réponse de diagnostics mal formée (null, tableau manquant) est une erreur, jamais un plantage', async () => {
    const bad = async (data: unknown) => (await runProbes(deps({ diagnostics: async () => ({ data, error: null }) }))).diagnostics;
    expect(await bad(null)).toEqual({ ok: false, reason: 'error' });
    expect(await bad({ tables: [] })).toEqual({ ok: false, reason: 'error' });
    expect(await bad({ tables: [1], tables_without_rls: [], functions: [], realtime_tables: [], extensions: [], cron_jobs: null })).toEqual({ ok: false, reason: 'error' });
  });

  it('une RPC qui ne répond jamais n\'empêche pas le diagnostic d\'aboutir', async () => {
    jest.useFakeTimers();
    const run = runProbes(deps({ diagnostics: () => new Promise(() => undefined) }));
    await jest.advanceTimersByTimeAsync(9000);
    expect((await run).diagnostics).toEqual({ ok: false, reason: 'error' });
    jest.useRealTimers();
  });
});

describe('sonde Realtime réelle', () => {
  it('ne rappelle pas removeChannel à l\'infini quand la fermeture du canal renvoie le statut CLOSED', async () => {
    jest.useRealTimers();
    let callback: ((status: string) => void) | undefined;
    const removeChannel = jest.fn(() => {
      callback?.('CLOSED'); // comportement de supabase-js : fermer le canal notifie le callback
      return Promise.resolve('ok');
    });
    jest.resetModules();
    jest.doMock('@/api/supabase', () => ({
      supabase: {
        channel: () => ({ subscribe: (cb: (s: string) => void) => { callback = cb; } }),
        removeChannel,
        auth: { getSession: async () => ({ data: { session: null } }) },
        rpc: async () => ({ data: null, error: null }),
      },
    }));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { liveProbeDeps } = require('@/api/health') as typeof import('@/api/health');
    const pending = liveProbeDeps().realtime(1000);
    callback?.('SUBSCRIBED');
    await expect(pending).resolves.toBe('SUBSCRIBED');
    expect(removeChannel).toHaveBeenCalledTimes(1);
  });
});

import { corsHeaders, jsonResponse, preflight } from '../../../supabase/functions/_shared/cors';

describe('CORS des Edge Functions (appels depuis le navigateur)', () => {
  it('répond au préflight OPTIONS sans authentification, avec les en-têtes requis par supabase-js', () => {
    const res = preflight(new Request('https://x.supabase.co/functions/v1/redeem-invite', { method: 'OPTIONS' }));
    expect(res?.status).toBe(204);
    expect(res?.headers.get('Access-Control-Allow-Origin')).toBe('*');
    const allowed = res?.headers.get('Access-Control-Allow-Headers') ?? '';
    for (const h of ['authorization', 'apikey', 'x-client-info', 'content-type']) expect(allowed).toContain(h);
    expect(res?.headers.get('Access-Control-Allow-Methods')).toContain('POST');
  });
  it('ne court-circuite pas les vraies requêtes', () => {
    expect(preflight(new Request('https://x', { method: 'POST' }))).toBeNull();
  });
  it('les réponses JSON portent les en-têtes CORS', async () => {
    const res = jsonResponse({ memberId: null }, 409);
    expect(res.status).toBe(409);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(corsHeaders['Access-Control-Allow-Origin']);
    expect(await res.json()).toEqual({ memberId: null });
  });
});

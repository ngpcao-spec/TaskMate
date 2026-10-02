// Edge Function `redeem-invite` (SPEC §5.8, D-011).
// Fine par conception : extrait l'IP et appelle la RPC `redeem_invite` AVEC LE JWT DE L'UTILISATEUR
// (auth.uid() reste l'enfant). La limite « 5 échecs / 15 min » est appliquée en SQL, par compte et par IP.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const authorization = req.headers.get('Authorization');
  if (!authorization) return json({ error: 'not_authenticated' }, 401);

  const { code, displayName } = (await req.json().catch(() => ({}))) as { code?: string; displayName?: string };
  if (typeof code !== 'string' || code.length > 16) return json({ memberId: null });

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });

  const { data, error } = await client.rpc('redeem_invite', {
    p_code: code,
    p_display_name: displayName,
    p_extra_key: ip ?? undefined,
  });
  if (error) {
    const status = error.message === 'too_many_attempts' ? 429 : error.message === 'not_authenticated' ? 401 : 409;
    return json({ error: error.message }, status);
  }
  return json({ memberId: data });
});

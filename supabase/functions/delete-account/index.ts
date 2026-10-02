// Edge Function `delete-account` (SPEC §3.9) : suppression de la famille et de TOUTES ses données, puis des comptes auth.
// 1) RPC `delete_family()` avec le JWT du parent (vérifie le rôle, purge les tables, renvoie les user_id) ;
// 2) suppression des comptes auth avec la clé service (impossible côté client).
import { createClient } from 'jsr:@supabase/supabase-js@2';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const authorization = req.headers.get('Authorization');
  if (!authorization) return json({ error: 'not_authenticated' }, 401);

  const asUser = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: userIds, error } = await asUser.rpc('delete_family');
  if (error) return json({ error: error.message }, error.message === 'forbidden' ? 403 : 400);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  let deleted = 0;
  for (const id of (userIds ?? []) as string[]) {
    const { error: e } = await admin.auth.admin.deleteUser(id);
    if (!e) deleted += 1;
  }
  return json({ deleted });
});

// Câblage Deno des Edge Functions de comptes enfants. La clé service_role vient UNIQUEMENT de l'environnement Supabase des
// fonctions (SUPABASE_SERVICE_ROLE_KEY, injectée par la plateforme) : elle n'est ni dans le code, ni dans git, ni côté client.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { jsonResponse, preflight } from './cors.ts';
import {
  createChildAccount,
  deleteChildAccount,
  resetChildPassword,
  type ChildAccountDeps,
  type Outcome,
  type Target,
} from './child-accounts.ts';

type Operation = (deps: ChildAccountDeps, body: unknown) => Promise<Outcome>;

function randomPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes));
}

export function serveChildAccountFunction(operation: Operation): void {
  Deno.serve(async (req) => {
    const early = preflight(req);
    if (early) return early;
    if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);
    const authorization = req.headers.get('Authorization');
    if (!authorization) return jsonResponse({ error: 'not_authenticated' }, 401);

    const url = Deno.env.get('SUPABASE_URL')!;
    const asCaller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

    const deps: ChildAccountDeps = {
      target: async (childId) => {
        const { data, error } = await asCaller.rpc('child_account_target', { p_child_id: childId });
        return { data: (data as Target | null) ?? null, error };
      },
      createUser: async (email, password) => {
        const { data, error } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true, // aucun e-mail n'est jamais envoyé
          app_metadata: { account_type: 'child' }, // non modifiable par l'utilisateur ; interdit la création de famille
        });
        if (error || !data.user) {
          const code = (error as { code?: string } | null)?.code ?? '';
          if (code === 'email_exists' || code === 'user_already_exists') return { userId: null, error: 'email_exists' };
          if (code === 'weak_password') return { userId: null, error: 'weak_password' };
          return { userId: null, error: 'other' };
        }
        return { userId: data.user.id, error: null };
      },
      deleteUser: async (userId) => {
        await admin.auth.admin.deleteUser(userId);
      },
      register: async (childId, userId, loginId) => {
        const { error } = await admin.rpc('register_child_account', { p_child_id: childId, p_user_id: userId, p_login_id: loginId });
        return { error };
      },
      remove: async (childId) => {
        const { data, error } = await admin.rpc('remove_child_account', { p_child_id: childId });
        return { userId: (data as string | null) ?? null, error };
      },
      setPassword: async (userId, password) => {
        const { error } = await admin.auth.admin.updateUserById(userId, { password });
        return { error: error !== null };
      },
      lockUser: async (userId, tombstone, password) => {
        const { error } = await admin.auth.admin.updateUserById(userId, { email: tombstone, password, email_confirm: true, ban_duration: '876000h' });
        return { error: error !== null };
      },
      softDeleteProfile: async (childId) => {
        const { error } = await asCaller.from('children').update({ deleted_at: new Date().toISOString() }).eq('id', childId);
        return { error: error !== null };
      },
      randomPassword,
    };

    const body = await req.json().catch(() => ({}));
    const outcome = await operation(deps, body);
    return jsonResponse(outcome.body, outcome.status);
  });
}

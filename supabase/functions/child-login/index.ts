// Edge Function `child-login` : connexion d'un enfant (e-mail d'un parent de la famille + identifiant + mot de passe).
// Publique (verify_jwt = false : l'enfant n'a pas encore de session) ; protégée par verrouillage par IP et par famille et par une
// réponse d'échec unique. La clé service_role vient UNIQUEMENT de l'environnement Supabase des fonctions (jamais dans le code,
// git ou le client) ; elle sert aux RPC de verrou/vérification et à émettre la session de l'enfant après vérification du mot de
// passe contre le haché (le mot de passe GoTrue des comptes enfants est aléatoire et inconnu : pas de connexion directe).
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { jsonResponse, preflight } from '../_shared/cors.ts';
import { childLogin, clientIp, type ChildLoginDeps, type LoginPlan } from '../_shared/child-login.ts';

Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const anon = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });

  const deps: ChildLoginDeps = {
    prepare: async (ip, parentEmail, loginId) => {
      const { data, error } = await admin.rpc('child_login_prepare', { p_ip: ip, p_parent_email: parentEmail, p_login_id: loginId });
      return { data: (data as LoginPlan | null) ?? null, error: error !== null };
    },
    recordFailure: async (ipKey, familyKey) => {
      await admin.rpc('child_login_record_failure', { p_ip_key: ipKey, p_family_key: familyKey });
    },
    checkPassword: async (authEmail, password) => {
      const { data, error } = await admin.rpc('child_login_check_password', { p_auth_email: authEmail, p_password: password });
      return { ok: data === true, error: error !== null };
    },
    mintSession: async (authEmail) => {
      // lien magique généré côté serveur (aucun e-mail envoyé), échangé immédiatement contre une session
      const { data: link, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email: authEmail });
      const tokenHash = link?.properties?.hashed_token;
      if (error || !tokenHash) return { session: null };
      const { data, error: verifyError } = await anon.auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' });
      return { session: verifyError || !data.session ? null : data.session };
    },
  };

  const body = await req.json().catch(() => ({}));
  const outcome = await childLogin(deps, clientIp(req.headers), body);
  return jsonResponse(outcome.body, outcome.status);
});

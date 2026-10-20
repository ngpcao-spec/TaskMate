import { config } from '@/config';
import { AuthFlowError } from './auth';
import { supabase } from './supabase';

/**
 * Web : redirige vers Google (e-mail vérifié par Google) puis revient sur le site, où supabase-js lit la session dans l'URL.
 * `prompt=select_account` : Google affiche TOUJOURS le sélecteur de compte (sinon, sur iPhone / PWA, le dernier compte utilisé est reconnecté en silence,
 * même après « Đăng xuất », et un 2e parent ne peut pas prendre son propre compte). On ne déconnecte jamais l'utilisateur de son compte Google lui-même.
 */
export async function startGoogleSignIn(): Promise<void> {
  const redirectTo = config.webUrl || window.location.origin;
  const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo, queryParams: { prompt: 'select_account' } } });
  if (error) throw new AuthFlowError('unknown');
}

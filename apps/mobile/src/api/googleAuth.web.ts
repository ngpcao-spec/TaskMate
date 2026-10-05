import { config } from '@/config';
import { AuthFlowError } from './auth';
import { supabase } from './supabase';

/** Web : redirige vers Google (e-mail vérifié par Google) puis revient sur le site, où supabase-js lit la session dans l'URL. */
export async function startGoogleSignIn(): Promise<void> {
  const redirectTo = config.webUrl || window.location.origin;
  const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
  if (error) throw new AuthFlowError('unknown');
}

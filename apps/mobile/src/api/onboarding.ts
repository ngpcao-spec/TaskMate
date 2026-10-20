import { parseOnboarding, type ServerOnboarding, type StepKey } from '@/domain/onboarding';
import { supabase } from './supabase';

/** État de l'assistant du parent connecté (RPC `onboarding_state`) : sa progression + les faits de SA famille. */
export async function fetchOnboarding(): Promise<ServerOnboarding> {
  const { data, error } = await supabase.rpc('onboarding_state');
  if (error) throw error;
  const parsed = parseOnboarding(data);
  if (!parsed) throw new Error('onboarding_unreadable');
  return parsed;
}

/** `confirm` (langue seulement), `skip` (tout sauf le premier enfant), `unskip` : écriture par RPC, jamais directe. */
export async function setOnboardingStep(step: StepKey, action: 'confirm' | 'skip' | 'unskip'): Promise<void> {
  const { error } = await supabase.rpc('onboarding_set', { p_step: step, p_action: action });
  if (error) throw error;
}

export async function hideSetupCard(hidden: boolean): Promise<void> {
  const { error } = await supabase.rpc('onboarding_hide_card', { p_hidden: hidden });
  if (error) throw error;
}

/** « Relancer l'assistant » (Réglages) : langue à reconfirmer, étapes passées effacées, carte visible ; les données saisies ne sont pas touchées. */
export async function restartOnboarding(): Promise<void> {
  const { error } = await supabase.rpc('onboarding_restart');
  if (error) throw error;
}

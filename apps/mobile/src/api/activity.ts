import { supabase } from './supabase';

/** Dernière activité du membre connecté (D-102) : la base n'écrit qu'une fois par heure et par membre ; aucune erreur n'est jamais montrée à l'utilisateur. */
export async function touchActivity(): Promise<void> {
  const { error } = await supabase.rpc('touch_activity');
  if (error) throw error;
}

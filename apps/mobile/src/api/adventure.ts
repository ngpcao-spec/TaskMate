import { parseAdventureState, type AdventureState } from '@/domain/adventure';
import { supabase } from './supabase';

/** État des aventures d'un enfant (RPC : l'enfant lui-même ou un parent de sa famille ; sinon `forbidden`). */
export async function fetchAdventureState(childId: string): Promise<AdventureState> {
  const { data, error } = await supabase.rpc('adventure_state', { p_child: childId });
  if (error) throw error;
  return parseAdventureState(data);
}

/** Départ (l'ENFANT pour lui-même) : id fixé par l'appelant → rejeu idempotent. Partir ne retire aucune énergie. */
export async function startAdventure(childId: string, adventureId: string, destination: string): Promise<void> {
  const { error } = await supabase.rpc('adventure_start', { p_child: childId, p_id: adventureId, p_destination: destination });
  if (error) throw error;
}

export type CollectResult = { discoverySlug: string; duplicate: boolean; destination: string };

/** Récupération de la trouvaille (l'ENFANT pour lui-même), tirée par le SERVEUR ; un second appel renvoie la même. */
export async function collectAdventure(childId: string, adventureId: string): Promise<CollectResult> {
  const { data, error } = await supabase.rpc('adventure_collect', { p_child: childId, p_adventure: adventureId });
  if (error) throw error;
  const r = (data ?? {}) as Record<string, unknown>;
  return { discoverySlug: String(r.discovery_slug ?? ''), duplicate: r.duplicate === true, destination: String(r.destination ?? '') };
}

import { parseCompanionState, type CompanionState, type PandaTrait, type StageOffset } from '@/domain/panda';
import { supabase } from './supabase';

/** État du compagnon d'un enfant (RPC : l'enfant lui-même ou un parent de sa famille ; sinon `forbidden`). */
export async function fetchCompanionState(childId: string): Promise<CompanionState> {
  const { data, error } = await supabase.rpc('companion_state', { p_child: childId });
  if (error) throw error;
  return parseCompanionState(data);
}

/** Crée ou met à jour le nom et le trait (l'enfant pour lui-même, ou un parent de la famille). Ne touche jamais au stade. */
export async function setupCompanion(childId: string, name: string, trait: PandaTrait): Promise<void> {
  const { error } = await supabase.rpc('companion_setup', { p_child: childId, p_name: name, p_trait: trait });
  if (error) throw error;
}

/** Décalage de stade (−1, 0, +1) : l'ENFANT seulement, pour lui-même (le serveur refuse un parent). */
export async function setCompanionStageOffset(childId: string, offset: StageOffset): Promise<void> {
  const { error } = await supabase.rpc('companion_set_stage_offset', { p_child: childId, p_offset: offset });
  if (error) throw error;
}

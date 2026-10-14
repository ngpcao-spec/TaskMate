import { avatarMap, type AvatarInfo } from '@/domain/avatar';
import { GenerateError, parseFailure } from './generate';
import { supabase } from './supabase';

/** Avatars et consentements visibles par l'utilisateur (RLS : parents → toute la famille ; enfant → lui seul, D-052). Jamais le candidat. */
export async function fetchAvatars(): Promise<Record<string, AvatarInfo>> {
  const { data, error } = await supabase.from('child_avatars').select('child_id, ai_allowed, image_b64, version');
  if (error) throw error;
  return avatarMap(data);
}

/** Consentement du parent : active ou coupe la création d'avatar par IA pour un enfant (RPC, parent uniquement). */
export async function setAvatarAllowed(childId: string, allowed: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_avatar_ai_allowed', { p_child: childId, p_allowed: allowed });
  if (error) throw error;
}

export type AvatarCandidate = { candidate: string; child_id: string; remaining: number };

/**
 * Envoie le portrait (JPEG en base64, sans préfixe) à l'Edge Function `generate-avatar` (en ligne uniquement). Le portrait n'est conservé nulle part :
 * la réponse contient seulement le DESSIN, à valider avec `confirmAvatar`. `childId` : requis pour un parent, ignoré pour un enfant.
 */
export async function generateAvatar(image: string, childId: string | null): Promise<AvatarCandidate> {
  const { data, error } = await supabase.functions.invoke<AvatarCandidate>('generate-avatar', { method: 'POST', body: childId ? { childId, image } : { image } });
  if (error || !data) throw await parseFailure(error);
  return data;
}

export { GenerateError as AvatarError };

/** « Dùng ảnh này » : le candidat devient l'avatar. */
export async function confirmAvatar(childId: string): Promise<void> {
  const { error } = await supabase.rpc('confirm_child_avatar', { p_child: childId });
  if (error) throw error;
}

export async function discardAvatarCandidate(childId: string): Promise<void> {
  const { error } = await supabase.rpc('discard_avatar_candidate', { p_child: childId });
  if (error) throw error;
}

export async function removeAvatar(childId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_child_avatar', { p_child: childId });
  if (error) throw error;
}

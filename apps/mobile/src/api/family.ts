import type { ChildRow, FamilyRow, MemberRow } from '@/types/models';
import { normalizeInviteCode, toJoinFailure, type JoinFailure } from '@/domain/parent-invite';
import { supabase } from './supabase';

export type Me = { member: MemberRow; family: FamilyRow; children: ChildRow[] };

/** Membership actif de l'utilisateur courant (null s'il n'a pas encore de famille ou s'il est révoqué). */
export async function fetchMe(userId: string): Promise<Me | null> {
  const { data: member, error } = await supabase
    .from('members')
    .select('*')
    .eq('user_id', userId)
    .is('revoked_at', null)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw error;
  if (!member) return null;
  const [family, children] = await Promise.all([
    supabase.from('families').select('*').eq('id', member.family_id).single(),
    supabase
      .from('children')
      .select('*')
      .eq('family_id', member.family_id)
      .is('deleted_at', null)
      .order('sort_order')
      .order('birth_date'),
  ]);
  if (family.error) throw family.error;
  if (children.error) throw children.error;
  return { member, family: family.data, children: children.data };
}

export async function createFamily(name: string, displayName: string, timezone?: string): Promise<string> {
  const { data, error } = await supabase.rpc('create_family', {
    p_name: name,
    p_display_name: displayName,
    ...(timezone ? { p_timezone: timezone } : {}),
  });
  if (error) throw error;
  return data;
}

export type NewChild = { name: string; birthDate: string; color: string; label?: string; sortOrder: number };

export async function createChild(familyId: string, child: NewChild): Promise<ChildRow> {
  const { data, error } = await supabase
    .from('children')
    .insert({
      family_id: familyId,
      name: child.name,
      birth_date: child.birthDate,
      color: child.color,
      label: child.label ?? null,
      sort_order: child.sortOrder,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

// ───────────── plusieurs parents par famille (D-050) ─────────────
export class FamilyActionError extends Error {
  constructor(readonly failure: JoinFailure) {
    super(failure);
    this.name = 'FamilyActionError';
  }
}

/** « Rejoindre une famille » : null = code faux, expiré, déjà utilisé ou annulé (message identique, pour ne rien révéler). */
export async function joinFamilyWithCode(code: string, displayName: string): Promise<void> {
  const { data, error } = await supabase.rpc('join_family_with_code', { p_code: normalizeInviteCode(code), p_display_name: displayName });
  if (error) throw new FamilyActionError(toJoinFailure(error.message));
  if (!data) throw new FamilyActionError('invalidCode');
}

/** Génère (ou régénère, ce qui annule la précédente) l'invitation : le code en clair n'est renvoyé QU'UNE FOIS. */
export async function createParentInvite(): Promise<string> {
  const { data, error } = await supabase.rpc('create_parent_invite');
  if (error) throw error;
  return data;
}

export async function revokeParentInvite(): Promise<void> {
  const { error } = await supabase.rpc('revoke_parent_invite');
  if (error) throw error;
}

export type ActiveParentInvite = { id: string; expires_at: string };

/** Invitation active (non utilisée, non annulée, non expirée) de la famille ; le code, lui, n'est jamais relisible. */
export async function fetchActiveParentInvite(): Promise<ActiveParentInvite | null> {
  const { data, error } = await supabase
    .from('parent_invites')
    .select('id, expires_at')
    .is('used_at', null)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  if (error) throw error;
  return data;
}

export type FamilyParent = { id: string; display_name: string };

export async function fetchParents(): Promise<FamilyParent[]> {
  const { data, error } = await supabase.from('members').select('id, display_name').eq('role', 'parent').is('revoked_at', null).is('deleted_at', null).order('created_at');
  if (error) throw error;
  return data;
}

/** Quitter la famille ; `last_parent` si c'est le dernier parent (il doit supprimer la famille). */
export async function leaveFamily(): Promise<void> {
  const { error } = await supabase.rpc('leave_family');
  if (error) throw new FamilyActionError(error.message === 'last_parent' ? 'lastParent' : 'unknown');
}

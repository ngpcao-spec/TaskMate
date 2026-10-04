import type { ChildRow, FamilyRow, MemberRow } from '@/types/models';
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

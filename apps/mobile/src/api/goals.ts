import type { GoalRow } from '@/types/db';
import { newId } from './ids';
import { supabase } from './supabase';

export async function fetchGoals(childId: string): Promise<GoalRow[]> {
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .eq('child_id', childId)
    .is('deleted_at', null)
    .order('created_at');
  if (error) throw error;
  return data;
}

export type GoalInput = { title: string; icon: string; target: number; unit?: string | null };

export async function createGoal(familyId: string, memberId: string, childId: string, input: GoalInput): Promise<void> {
  const { error } = await supabase.from('goals').insert({
    id: newId(),
    family_id: familyId,
    child_id: childId,
    created_by: memberId,
    title: input.title,
    icon: input.icon,
    target: input.target,
    unit: input.unit?.trim() ? input.unit.trim() : null,
  });
  if (error) throw error;
}

export async function updateGoal(id: string, patch: Partial<GoalInput> & { progress?: number }): Promise<void> {
  const { error } = await supabase.from('goals').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteGoal(id: string): Promise<void> {
  const { error } = await supabase.from('goals').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

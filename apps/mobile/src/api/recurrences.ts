import type { RecurrenceFields } from '@/domain/task-form';
import type { TaskPatch } from './tasks';
import { newId } from './ids';
import { supabase } from './supabase';

/** Parent uniquement (RLS). Les occurrences sont générées par le serveur (trigger + pg_cron, §5.3). */
export async function createRecurrences(familyId: string, memberId: string, rows: RecurrenceFields[]): Promise<void> {
  const { error } = await supabase
    .from('recurrences')
    .insert(rows.map((r) => ({ ...r, id: newId(), family_id: familyId, created_by: memberId })));
  if (error) throw error;
}

/** Met à jour la série : le serveur aligne les occurrences futures non faites. */
export async function updateRecurrence(id: string, patch: Omit<TaskPatch, 'child_id' | 'date'>): Promise<void> {
  const { error } = await supabase.from('recurrences').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteRecurrence(id: string): Promise<void> {
  const { error } = await supabase.from('recurrences').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

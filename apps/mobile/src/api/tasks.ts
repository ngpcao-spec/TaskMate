import type { TaskInsertFields } from '@/domain/task-form';
import type { TaskRow } from '@/types/db';
import { supabase } from './supabase';

export async function fetchTasks(childId: string, from: string, to: string): Promise<TaskRow[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('child_id', childId)
    .gte('date', from)
    .lte('date', to)
    .is('deleted_at', null)
    .order('date')
    .order('start_time', { nullsFirst: false });
  if (error) throw error;
  return data;
}

export async function fetchTask(id: string): Promise<TaskRow | null> {
  const { data, error } = await supabase.from('tasks').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

/** Coche/décoche : toujours via RPC (§5.2). `txId` est fixé à la création de la mutation → rejeu idempotent. */
export async function setTaskCompleted(taskId: string, completed: boolean, txId: string): Promise<void> {
  const { error } = completed
    ? await supabase.rpc('complete_task', { p_task_id: taskId, p_tx_id: txId })
    : await supabase.rpc('uncomplete_task', { p_task_id: taskId, p_tx_id: txId });
  if (error) throw error;
}

export type NewTask = TaskInsertFields & { id: string };

export async function createTasks(familyId: string, createdBy: string, tasks: NewTask[]): Promise<void> {
  const { error } = await supabase
    .from('tasks')
    .insert(tasks.map((t) => ({ ...t, family_id: familyId, created_by: createdBy })));
  if (error) throw error;
}

export type TaskPatch = Partial<Omit<TaskInsertFields, 'child_id'>> & { child_id?: string };

export async function updateTask(id: string, patch: TaskPatch): Promise<void> {
  const { error } = await supabase.from('tasks').update(patch).eq('id', id);
  if (error) throw error;
}

/** Suppression logique (soft delete) : les points déjà gagnés restent acquis (§5.2 [H]). */
export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from('tasks').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

/** Message d'erreur serveur normalisé (les RPC lèvent des codes courts : `task_not_found`, …). */
export function serverErrorCode(error: unknown): string {
  return typeof error === 'object' && error !== null && 'message' in error ? String((error as { message: unknown }).message) : '';
}

/** Toutes les tâches d'un profil (liste « Danh sách việc »), plus récentes d'abord, plafonnées. */
export async function fetchAllTasks(childId: string, limit = 500): Promise<TaskRow[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('child_id', childId)
    .is('deleted_at', null)
    .order('date', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

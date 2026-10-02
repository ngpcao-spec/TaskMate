import { useMutation, useQuery } from '@tanstack/react-query';
import { taskKeys } from '@/api/keys';
import { fetchAllTasks, fetchPendingTasks, fetchTasks, type TaskPatch } from '@/api/tasks';
import {
  mutationKeys,
  type CreateVars,
  type RejectVars,
  type ToggleVars,
  type UpdateVars,
  type ValidateVars,
} from '@/sync/mutations';
import type { TaskRow } from '@/types/models';

export { toggleVars, validateVars } from '@/sync/mutations';

export function useTasks(childId: string | null, from: string, to: string = from) {
  return useQuery({
    queryKey: taskKeys.range(childId ?? 'none', from, to),
    queryFn: () => fetchTasks(childId as string, from, to),
    enabled: childId !== null,
  });
}

export function useAllTasks(childId: string | null) {
  return useQuery({
    queryKey: [...taskKeys.all(childId ?? 'none'), 'all'],
    queryFn: () => fetchAllTasks(childId as string),
    enabled: childId !== null,
  });
}

/** File « Cần duyệt » (parent) : tâches cochées non validées de toute la famille. */
export const usePendingTasks = (enabled: boolean) => useQuery({ queryKey: taskKeys.pending, queryFn: fetchPendingTasks, enabled });

// Les mutations sont définies (fonction, optimisme, rollback, rejeu) dans `sync/mutations.ts`
// pour pouvoir être reprises après un redémarrage de l'app.
export const useToggleTask = () => useMutation<void, unknown, ToggleVars>({ mutationKey: mutationKeys.toggleTask });
export const useCreateTasks = () => useMutation<void, unknown, CreateVars>({ mutationKey: mutationKeys.createTasks });
export const useUpdateTask = () => useMutation<void, unknown, UpdateVars>({ mutationKey: mutationKeys.updateTask });
export const useValidateTask = () => useMutation<void, unknown, ValidateVars>({ mutationKey: mutationKeys.validateTask });
export const useRejectTask = () => useMutation<void, unknown, RejectVars>({ mutationKey: mutationKeys.rejectTask });
export const useDeleteTask = () => useMutation<void, unknown, TaskRow>({ mutationKey: mutationKeys.deleteTask });

export type { TaskPatch };

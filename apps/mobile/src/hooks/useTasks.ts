import { useMutation, useQuery } from '@tanstack/react-query';
import { taskKeys } from '@/api/keys';
import { fetchTasks, type TaskPatch } from '@/api/tasks';
import {
  mutationKeys,
  type CreateVars,
  type ToggleVars,
  type UpdateVars,
} from '@/sync/mutations';
import type { TaskRow } from '@/types/db';

export { toggleVars } from '@/sync/mutations';

export function useTasks(childId: string | null, from: string, to: string = from) {
  return useQuery({
    queryKey: taskKeys.range(childId ?? 'none', from, to),
    queryFn: () => fetchTasks(childId as string, from, to),
    enabled: childId !== null,
  });
}

// Les mutations sont définies (fonction, optimisme, rollback, rejeu) dans `sync/mutations.ts`
// pour pouvoir être reprises après un redémarrage de l'app.
export const useToggleTask = () => useMutation<void, unknown, ToggleVars>({ mutationKey: mutationKeys.toggleTask });
export const useCreateTasks = () => useMutation<void, unknown, CreateVars>({ mutationKey: mutationKeys.createTasks });
export const useUpdateTask = () => useMutation<void, unknown, UpdateVars>({ mutationKey: mutationKeys.updateTask });
export const useDeleteTask = () => useMutation<void, unknown, TaskRow>({ mutationKey: mutationKeys.deleteTask });

export type { TaskPatch };

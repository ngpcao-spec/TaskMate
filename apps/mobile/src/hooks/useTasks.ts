import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createTasks,
  deleteTask,
  fetchTasks,
  serverErrorCode,
  setTaskCompleted,
  updateTask,
  type NewTask,
  type TaskPatch,
} from '@/api/tasks';
import { newId } from '@/api/ids';
import { taskKeys } from '@/api/keys';
import { useToastStore } from '@/store/toast';
import type { TaskRow } from '@/types/db';
import i18n from '@/i18n';

export function useTasks(childId: string | null, from: string, to: string = from) {
  return useQuery({
    queryKey: taskKeys.range(childId ?? 'none', from, to),
    queryFn: () => fetchTasks(childId as string, from, to),
    enabled: childId !== null,
  });
}

type ToggleVars = { task: TaskRow; completed: boolean; txId: string };

/** Variables d'une coche : le `txId` est tiré ici, une seule fois, pour que tout rejeu reste idempotent. */
export const toggleVars = (task: TaskRow, completed: boolean): ToggleVars => ({ task, completed, txId: newId() });

/** Applique `fn` à toutes les listes de tâches en cache d'un enfant (jour, semaine, mois…). */
function patchCachedTasks(
  queryClient: ReturnType<typeof useQueryClient>,
  childId: string,
  fn: (tasks: TaskRow[]) => TaskRow[],
) {
  queryClient.setQueriesData<TaskRow[]>({ queryKey: taskKeys.all(childId) }, (old) => (old ? fn(old) : old));
}

export function useToggleTask() {
  const queryClient = useQueryClient();
  const show = useToastStore((s) => s.show);
  return useMutation({
    mutationFn: ({ task, completed, txId }: ToggleVars) => setTaskCompleted(task.id, completed, txId),
    onMutate: async ({ task, completed }) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.all(task.child_id) });
      const snapshot = queryClient.getQueriesData<TaskRow[]>({ queryKey: taskKeys.all(task.child_id) });
      const stamp = completed ? new Date().toISOString() : null;
      patchCachedTasks(queryClient, task.child_id, (list) =>
        list.map((t) => (t.id === task.id ? { ...t, completed_at: stamp } : t)),
      );
      return { snapshot };
    },
    onError: (error, { task }, context) => {
      context?.snapshot.forEach(([key, data]) => queryClient.setQueryData(key, data));
      const code = serverErrorCode(error);
      if (code === 'task_not_found') {
        patchCachedTasks(queryClient, task.child_id, (list) => list.filter((t) => t.id !== task.id));
        show(i18n.t('today.taskGone'), 'error');
      } else if (code === 'insufficient_balance') {
        show(i18n.t('today.cannotUncheck'), 'error');
      } else {
        show(i18n.t('common.error'), 'error');
      }
    },
    onSettled: (_data, _error, { task }) => {
      void queryClient.invalidateQueries({ queryKey: taskKeys.all(task.child_id) });
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  const show = useToastStore((s) => s.show);
  return useMutation({
    mutationFn: (task: TaskRow) => deleteTask(task.id),
    onMutate: async (task) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.all(task.child_id) });
      const snapshot = queryClient.getQueriesData<TaskRow[]>({ queryKey: taskKeys.all(task.child_id) });
      patchCachedTasks(queryClient, task.child_id, (list) => list.filter((t) => t.id !== task.id));
      return { snapshot };
    },
    onSuccess: () => show(i18n.t('taskForm.deleted')),
    onError: (_error, _task, context) => {
      context?.snapshot.forEach(([key, data]) => queryClient.setQueryData(key, data));
      show(i18n.t('common.error'), 'error');
    },
    onSettled: (_d, _e, task) => void queryClient.invalidateQueries({ queryKey: taskKeys.all(task.child_id) }),
  });
}

export function useCreateTasks() {
  const queryClient = useQueryClient();
  const show = useToastStore((s) => s.show);
  return useMutation({
    mutationFn: ({ familyId, memberId, tasks }: { familyId: string; memberId: string; tasks: NewTask[] }) =>
      createTasks(familyId, memberId, tasks),
    onSuccess: () => show(i18n.t('taskForm.saved')),
    onError: () => show(i18n.t('common.error'), 'error'),
    onSettled: (_d, _e, { tasks }) => {
      for (const childId of new Set(tasks.map((t) => t.child_id))) {
        void queryClient.invalidateQueries({ queryKey: taskKeys.all(childId) });
      }
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  const show = useToastStore((s) => s.show);
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: TaskPatch; childIds: string[] }) => updateTask(id, patch),
    onSuccess: () => show(i18n.t('taskForm.saved')),
    onError: () => show(i18n.t('common.error'), 'error'),
    onSettled: (_d, _e, { id, childIds }) => {
      void queryClient.invalidateQueries({ queryKey: taskKeys.one(id) });
      for (const childId of childIds) void queryClient.invalidateQueries({ queryKey: taskKeys.all(childId) });
    },
  });
}

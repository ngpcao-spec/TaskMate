import type { QueryClient } from '@tanstack/react-query';
import { newId } from '@/api/ids';
import { taskKeys } from '@/api/keys';
import {
  createTasks,
  deleteTask,
  serverErrorCode,
  setTaskCompleted,
  updateTask,
  type NewTask,
  type TaskPatch,
} from '@/api/tasks';
import { isTransientError } from '@/domain/errors';
import { dateInRange, optimisticTask } from '@/domain/optimistic-task';
import i18n from '@/i18n';
import { useToastStore } from '@/store/toast';
import type { TaskRow } from '@/types/db';
import { patchCachedTaskRanges, patchCachedTasks, restoreSnapshot, snapshotTasks } from './cache';

export const mutationKeys = {
  toggleTask: ['toggleTask'] as const,
  createTasks: ['createTasks'] as const,
  updateTask: ['updateTask'] as const,
  deleteTask: ['deleteTask'] as const,
};

export type ToggleVars = { task: TaskRow; completed: boolean; txId: string };
export type CreateVars = { familyId: string; memberId: string; tasks: NewTask[] };
export type UpdateVars = { task: TaskRow; patch: TaskPatch };
type SnapshotCtx = { snapshot?: ReturnType<typeof snapshotTasks> };

/** Variables d'une coche : le `txId` est tiré ici, une seule fois — tout rejeu (retry, file hors ligne) reste idempotent. */
export const toggleVars = (task: TaskRow, completed: boolean): ToggleVars => ({ task, completed, txId: newId() });

const toast = (message: string, tone: 'info' | 'error' = 'info') => useToastStore.getState().show(message, tone);

/** Rejeu uniquement pour les erreurs réseau/serveur ; 6 essais max, délai exponentiel plafonné à 30 s. */
const retry = (failureCount: number, error: unknown) => isTransientError(error) && failureCount < 6;
const retryDelay = (attempt: number) => Math.min(1000 * 2 ** attempt, 30_000);

/**
 * File d'écritures hors ligne (SPEC §6) : toutes les mutations partagent la portée `writes`
 * → exécutées une par une, dans l'ordre (créer une tâche avant de la cocher). Elles sont persistées
 * quand elles sont en pause (réseau coupé) puis reprises par `resumePausedMutations`.
 */
export function registerMutationDefaults(
  queryClient: QueryClient,
  options: { retryDelay?: (attempt: number) => number } = {},
): void {
  const common = { scope: { id: 'writes' }, retry, retryDelay: options.retryDelay ?? retryDelay } as const;

  queryClient.setMutationDefaults(mutationKeys.toggleTask, {
    ...common,
    mutationFn: ({ task, completed, txId }: ToggleVars) => setTaskCompleted(task.id, completed, txId),
    onMutate: async ({ task, completed }: ToggleVars): Promise<SnapshotCtx> => {
      await queryClient.cancelQueries({ queryKey: taskKeys.all(task.child_id) });
      const snapshot = snapshotTasks(queryClient, task.child_id);
      const stamp = completed ? new Date().toISOString() : null;
      patchCachedTasks(queryClient, task.child_id, (list) =>
        list.map((t) => (t.id === task.id ? { ...t, completed_at: stamp } : t)),
      );
      return { snapshot };
    },
    onError: (error: unknown, { task }: ToggleVars, context: SnapshotCtx | undefined) => {
      restoreSnapshot(queryClient, context?.snapshot);
      const code = serverErrorCode(error);
      if (code === 'task_not_found') {
        patchCachedTasks(queryClient, task.child_id, (list) => list.filter((t) => t.id !== task.id));
        toast(i18n.t('today.taskGone'), 'error');
      } else if (code === 'insufficient_balance') {
        toast(i18n.t('today.cannotUncheck'), 'error');
      } else {
        toast(i18n.t('common.error'), 'error');
      }
    },
    onSettled: (_d: unknown, _e: unknown, { task }: ToggleVars) => {
      void queryClient.invalidateQueries({ queryKey: taskKeys.all(task.child_id) });
      void queryClient.invalidateQueries({ queryKey: ['balance', task.child_id] });
    },
  });

  queryClient.setMutationDefaults(mutationKeys.createTasks, {
    ...common,
    mutationFn: ({ familyId, memberId, tasks }: CreateVars) => createTasks(familyId, memberId, tasks),
    onMutate: async ({ familyId, memberId, tasks }: CreateVars): Promise<SnapshotCtx> => {
      const nowIso = new Date().toISOString();
      for (const fields of tasks) {
        await queryClient.cancelQueries({ queryKey: taskKeys.all(fields.child_id) });
        const row = optimisticTask(fields, { familyId, memberId, nowIso });
        patchCachedTaskRanges(queryClient, fields.child_id, (list, { from, to }) =>
          dateInRange(row.date, from, to) && !list.some((t) => t.id === row.id) ? [...list, row] : list,
        );
      }
      return {};
    },
    onError: () => toast(i18n.t('common.error'), 'error'),
    onSettled: (_d: unknown, _e: unknown, { tasks }: CreateVars) => {
      for (const childId of new Set(tasks.map((t) => t.child_id))) {
        void queryClient.invalidateQueries({ queryKey: taskKeys.all(childId) });
      }
    },
  });

  queryClient.setMutationDefaults(mutationKeys.updateTask, {
    ...common,
    mutationFn: ({ task, patch }: UpdateVars) => updateTask(task.id, patch),
    onMutate: async ({ task, patch }: UpdateVars): Promise<SnapshotCtx> => {
      await queryClient.cancelQueries({ queryKey: taskKeys.all(task.child_id) });
      const snapshot = snapshotTasks(queryClient, task.child_id);
      patchCachedTasks(queryClient, task.child_id, (list) =>
        list.map((t) => (t.id === task.id ? ({ ...t, ...patch } as TaskRow) : t)),
      );
      return { snapshot };
    },
    onError: (_e: unknown, _v: UpdateVars, context: SnapshotCtx | undefined) => {
      restoreSnapshot(queryClient, context?.snapshot);
      toast(i18n.t('common.error'), 'error');
    },
    onSettled: (_d: unknown, _e: unknown, { task }: UpdateVars) => {
      void queryClient.invalidateQueries({ queryKey: taskKeys.one(task.id) });
      void queryClient.invalidateQueries({ queryKey: taskKeys.all(task.child_id) });
    },
  });

  queryClient.setMutationDefaults(mutationKeys.deleteTask, {
    ...common,
    mutationFn: (task: TaskRow) => deleteTask(task.id),
    onMutate: async (task: TaskRow): Promise<SnapshotCtx> => {
      await queryClient.cancelQueries({ queryKey: taskKeys.all(task.child_id) });
      const snapshot = snapshotTasks(queryClient, task.child_id);
      patchCachedTasks(queryClient, task.child_id, (list) => list.filter((t) => t.id !== task.id));
      return { snapshot };
    },
    onError: (_e: unknown, _t: TaskRow, context: SnapshotCtx | undefined) => {
      restoreSnapshot(queryClient, context?.snapshot);
      toast(i18n.t('common.error'), 'error');
    },
    onSettled: (_d: unknown, _e: unknown, task: TaskRow) =>
      void queryClient.invalidateQueries({ queryKey: taskKeys.all(task.child_id) }),
  });
}

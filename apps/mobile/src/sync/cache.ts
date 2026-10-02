import type { QueryClient } from '@tanstack/react-query';
import { taskKeys } from '@/api/keys';
import type { TaskRow } from '@/types/models';

/** Applique `fn` à toutes les listes de tâches en cache d'un enfant (jour, semaine, mois…). */
export function patchCachedTasks(queryClient: QueryClient, childId: string, fn: (tasks: TaskRow[]) => TaskRow[]): void {
  queryClient.setQueriesData<TaskRow[]>({ queryKey: taskKeys.all(childId) }, (old) => (old ? fn(old) : old));
}

/** Variante qui connaît la plage `[from, to]` de chaque liste (clé `['tasks', childId, from, to]`). */
export function patchCachedTaskRanges(
  queryClient: QueryClient,
  childId: string,
  fn: (tasks: TaskRow[], range: { from: string; to: string }) => TaskRow[],
): void {
  for (const [key, data] of queryClient.getQueriesData<TaskRow[]>({ queryKey: taskKeys.all(childId) })) {
    const [, , from, to] = key as [string, string, string | undefined, string | undefined];
    if (!data || !from || !to) continue;
    queryClient.setQueryData<TaskRow[]>(key, fn(data, { from, to }));
  }
}

export function snapshotTasks(queryClient: QueryClient, childId: string) {
  return queryClient.getQueriesData<TaskRow[]>({ queryKey: taskKeys.all(childId) });
}

export function restoreSnapshot(queryClient: QueryClient, snapshot: ReturnType<typeof snapshotTasks> | undefined): void {
  snapshot?.forEach(([key, data]) => queryClient.setQueryData(key, data));
}

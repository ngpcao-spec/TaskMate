import { onlineManager, useIsMutating, useMutationState } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { mutationKeys } from '@/sync/mutations';

/** Réseau disponible ? (réactif) */
export function useOnline(): boolean {
  return useSyncExternalStore(
    (cb) => onlineManager.subscribe(cb),
    () => onlineManager.isOnline(),
    () => true,
  );
}

/** Nombre d'écritures en attente d'envoi (file d'attente + en cours). */
export function usePendingWrites(): number {
  return useIsMutating();
}

/** Ids des tâches avec une écriture en attente (indicateur discret sur la ligne). */
export function usePendingTaskIds(): ReadonlySet<string> {
  const ids = useMutationState({
    filters: { status: 'pending' },
    select: (m): string[] => {
      const key = m.options.mutationKey?.[0];
      const v = m.state.variables as { task?: { id: string }; tasks?: { id: string }[]; id?: string } | undefined;
      if (key === mutationKeys.createTasks[0]) return (v?.tasks ?? []).map((t) => t.id);
      return v?.task?.id ? [v.task.id] : v?.id ? [v.id] : [];
    },
  });
  return new Set(ids.flat());
}

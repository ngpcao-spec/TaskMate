import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createRecurrences, deleteRecurrence, updateRecurrence } from '@/api/recurrences';
import type { TaskPatch } from '@/api/tasks';
import type { RecurrenceFields } from '@/domain/task-form';
import i18n from '@/i18n';
import { useToastStore } from '@/store/toast';

function useSeriesMutation<V>(fn: (v: V) => Promise<void>, successKey: string) {
  const queryClient = useQueryClient();
  const show = useToastStore((s) => s.show);
  return useMutation<void, unknown, V>({
    networkMode: 'always', // création/édition de série : en ligne uniquement (le serveur génère les occurrences)
    mutationFn: fn,
    onSuccess: () => show(i18n.t(successKey)),
    onError: () => show(i18n.t('taskForm.seriesNeedsNetwork'), 'error'),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

export const useCreateRecurrences = () =>
  useSeriesMutation<{ familyId: string; memberId: string; rows: RecurrenceFields[] }>(
    ({ familyId, memberId, rows }) => createRecurrences(familyId, memberId, rows),
    'taskForm.saved',
  );
export const useUpdateRecurrence = () =>
  useSeriesMutation<{ id: string; patch: Omit<TaskPatch, 'child_id' | 'date'> }>(({ id, patch }) => updateRecurrence(id, patch), 'taskForm.saved');
export const useDeleteRecurrence = () => useSeriesMutation<string>((id) => deleteRecurrence(id), 'taskForm.seriesDeleted');

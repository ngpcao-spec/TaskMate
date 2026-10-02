import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createGoal, deleteGoal, fetchGoals, updateGoal, type GoalInput } from '@/api/goals';
import { clampProgress, justAchieved } from '@/domain/goals';
import i18n from '@/i18n';
import { useToastStore } from '@/store/toast';
import type { GoalRow } from '@/types/models';

export const goalKeys = { child: (childId: string) => ['goals', childId] as const };

export const useGoals = (childId: string | null) =>
  useQuery({ queryKey: goalKeys.child(childId ?? 'none'), queryFn: () => fetchGoals(childId as string), enabled: childId !== null });

/** Progression manuelle (−/+) : optimiste, valeur absolue envoyée (dernière écriture gagne, SPEC §5.9). */
export function useSetGoalProgress() {
  const queryClient = useQueryClient();
  const show = useToastStore((s) => s.show);
  return useMutation<void, unknown, { goal: GoalRow; progress: number }, { previous: [readonly unknown[], GoalRow[] | undefined][] }>({
    networkMode: 'always',
    mutationFn: ({ goal, progress }) => updateGoal(goal.id, { progress: clampProgress(progress) }),
    onMutate: async ({ goal, progress }) => {
      await queryClient.cancelQueries({ queryKey: goalKeys.child(goal.child_id) });
      const previous = queryClient.getQueriesData<GoalRow[]>({ queryKey: goalKeys.child(goal.child_id) });
      queryClient.setQueriesData<GoalRow[]>({ queryKey: goalKeys.child(goal.child_id) }, (old) =>
        old?.map((g) => (g.id === goal.id ? { ...g, progress: clampProgress(progress) } : g)),
      );
      return { previous };
    },
    onSuccess: (_d, { goal, progress }) => {
      if (justAchieved(goal.progress, clampProgress(progress), goal.target)) show(i18n.t('goals.achievedToast', { title: goal.title }));
    },
    onError: (_e, _v, context) => {
      context?.previous.forEach(([key, data]) => queryClient.setQueryData(key, data));
      show(i18n.t('common.error'), 'error');
    },
    onSettled: (_d, _e, { goal }) => void queryClient.invalidateQueries({ queryKey: goalKeys.child(goal.child_id) }),
  });
}

function useGoalMutation<V>(fn: (v: V) => Promise<void>, childIdOf: (v: V) => string) {
  const queryClient = useQueryClient();
  const show = useToastStore((s) => s.show);
  return useMutation<void, unknown, V>({
    networkMode: 'always',
    mutationFn: fn,
    onError: () => show(i18n.t('common.error'), 'error'),
    onSettled: (_d, _e, v) => void queryClient.invalidateQueries({ queryKey: goalKeys.child(childIdOf(v)) }),
  });
}

type SaveVars = { familyId: string; memberId: string; childId: string; input: GoalInput; id?: string };
export const useSaveGoal = () =>
  useGoalMutation<SaveVars>(
    ({ familyId, memberId, childId, input, id }) => (id ? updateGoal(id, input) : createGoal(familyId, memberId, childId, input)),
    (v) => v.childId,
  );
export const useDeleteGoal = () => useGoalMutation<GoalRow>((g) => deleteGoal(g.id), (g) => g.child_id);

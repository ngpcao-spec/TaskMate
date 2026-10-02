import { useMutation, useMutationState, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  adjustPoints,
  approveRewardRequest,
  cancelRewardRequest,
  deleteReward,
  fetchBalance,
  fetchRequests,
  fetchRewards,
  fetchTransactions,
  rejectRewardRequest,
  requestReward,
  saveReward,
  type RewardInput,
} from '@/api/points';
import { serverErrorCode } from '@/api/tasks';
import { pendingPointsDelta, projectBalance, type BalanceSnapshot } from '@/domain/rewards';
import i18n from '@/i18n';
import { mutationKeys, type ToggleVars } from '@/sync/mutations';
import { useToastStore } from '@/store/toast';

export const pointKeys = {
  balance: (childId: string) => ['balance', childId] as const,
  requests: (childId: string | null) => ['requests', childId ?? 'all'] as const,
  transactions: (childId: string) => ['transactions', childId] as const,
  rewards: ['rewards'] as const,
};

export function useBalance(childId: string | null) {
  return useQuery({ queryKey: pointKeys.balance(childId ?? 'none'), queryFn: () => fetchBalance(childId as string), enabled: childId !== null });
}

/** Solde + effet des coches encore en file d'attente (affichage projeté hors ligne, SPEC §5.2). */
export function useProjectedBalance(childId: string | null): BalanceSnapshot | null {
  const base = useBalance(childId).data;
  const pending = useMutationState({
    filters: { mutationKey: mutationKeys.toggleTask, status: 'pending' },
    select: (m) => m.state.variables as ToggleVars,
  });
  if (!base) return null;
  const mine = pending.filter((v) => v.task.child_id === childId).map((v) => ({ completed: v.completed, points: v.task.points }));
  return projectBalance(base, pendingPointsDelta(mine));
}

export const useRewards = () => useQuery({ queryKey: pointKeys.rewards, queryFn: fetchRewards });
export const useRequests = (childId: string | null, enabled = true) =>
  useQuery({ queryKey: pointKeys.requests(childId), queryFn: () => fetchRequests(childId), enabled });
export const useTransactions = (childId: string | null) =>
  useQuery({ queryKey: pointKeys.transactions(childId ?? 'none'), queryFn: () => fetchTransactions(childId as string), enabled: childId !== null });

function useInvalidatingMutation<V>(fn: (v: V) => Promise<void>, successMessage?: string) {
  const queryClient = useQueryClient();
  const show = useToastStore((s) => s.show);
  return useMutation<void, unknown, V>({
    mutationFn: fn,
    onSuccess: () => successMessage && show(successMessage),
    onError: (error) => {
      const code = serverErrorCode(error);
      show(
        code === 'insufficient_balance' ? i18n.t('points.errors.insufficient') : code === 'not_pending' ? i18n.t('points.errors.notPending') : i18n.t('common.error'),
        'error',
      );
    },
    onSettled: () => {
      for (const key of ['balance', 'requests', 'transactions', 'rewards']) void queryClient.invalidateQueries({ queryKey: [key] });
    },
  });
}

export const useRequestReward = () => useInvalidatingMutation((rewardId: string) => requestReward(rewardId), i18n.t('points.requestSent'));
export const useCancelRequest = () => useInvalidatingMutation((id: string) => cancelRewardRequest(id));
export const useApproveRequest = () => useInvalidatingMutation((id: string) => approveRewardRequest(id));
export const useRejectRequest = () => useInvalidatingMutation(({ id, note }: { id: string; note?: string }) => rejectRewardRequest(id, note));
export const useAdjustPoints = () =>
  useInvalidatingMutation(({ childId, delta, note }: { childId: string; delta: number; note: string }) => adjustPoints(childId, delta, note));
export const useSaveReward = () =>
  useInvalidatingMutation(({ familyId, input, id }: { familyId: string; input: RewardInput; id?: string }) => saveReward(familyId, input, id));
export const useDeleteReward = () => useInvalidatingMutation((id: string) => deleteReward(id));

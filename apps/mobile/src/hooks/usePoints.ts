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
import { optimisticRequest } from '@/domain/reward-exchange';
import { projectBalance, type BalanceSnapshot } from '@/domain/rewards';
import { parentPointsDelta } from '@/domain/task-state';
import i18n from '@/i18n';
import { mutationKeys, type ToggleVars, type ValidateVars } from '@/sync/mutations';
import { useToastStore } from '@/store/toast';
import type { RewardRequestRow } from '@/types/models';

export const pointKeys = {
  balance: (childId: string) => ['balance', childId] as const,
  requests: (childId: string | null) => ['requests', childId ?? 'all'] as const,
  transactions: (childId: string) => ['transactions', childId] as const,
  rewards: ['rewards'] as const,
};

export function useBalance(childId: string | null) {
  return useQuery({ queryKey: pointKeys.balance(childId ?? 'none'), queryFn: () => fetchBalance(childId as string), enabled: childId !== null });
}

/**
 * Solde + effet des écritures PARENT encore en file (affichage projeté hors ligne, SPEC §5.2).
 * L'ENFANT ne voit jamais son solde monter de façon optimiste : seule la validation serveur crédite.
 */
export function useProjectedBalance(childId: string | null, role: 'parent' | 'child'): BalanceSnapshot | null {
  const base = useBalance(childId).data;
  const toggles = useMutationState({ filters: { mutationKey: mutationKeys.toggleTask, status: 'pending' }, select: (m) => m.state.variables as ToggleVars });
  const validations = useMutationState({ filters: { mutationKey: mutationKeys.validateTask, status: 'pending' }, select: (m) => m.state.variables as ValidateVars });
  if (!base) return null;
  if (role === 'child') return base;
  const delta =
    toggles.filter((v) => v.asParent && v.task.child_id === childId).reduce((sum, v) => sum + parentPointsDelta(v.completed ? 'toggle-on' : 'toggle-off', v.task), 0) +
    validations.filter((v) => v.task.child_id === childId).reduce((sum, v) => sum + parentPointsDelta('validate', v.task), 0);
  return projectBalance(base, delta);
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
    // jamais mis en file : un échange/une approbation exige le réseau (SPEC §3.7) → échec immédiat hors ligne
    networkMode: 'always',
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

export type RequestRewardVars = { rewardId: string; childId: string; title: string; cost: number; requestId: string };

/**
 * Demande d'échange : la demande apparaît TOUT DE SUITE dans « Yêu cầu đổi thưởng » et ses points sont réservés dans le solde affiché (même id que
 * la ligne du serveur, `requestId` fixé par l'appelant) ; rien n'est gardé si le serveur refuse. Jamais mise en file (réseau exigé, SPEC §3.7).
 */
export function useRequestReward() {
  const queryClient = useQueryClient();
  const show = useToastStore((s) => s.show);
  type Snapshot = { requests: [readonly unknown[], RewardRequestRow[] | undefined][]; balance: BalanceSnapshot | undefined };
  return useMutation<void, unknown, RequestRewardVars, Snapshot>({
    mutationFn: (v) => requestReward(v.rewardId, v.requestId),
    networkMode: 'always',
    onMutate: async (v) => {
      await queryClient.cancelQueries({ queryKey: ['requests'] });
      await queryClient.cancelQueries({ queryKey: pointKeys.balance(v.childId) });
      const requests = queryClient.getQueriesData<RewardRequestRow[]>({ queryKey: ['requests'] });
      const balance = queryClient.getQueryData<BalanceSnapshot>(pointKeys.balance(v.childId));
      const row = optimisticRequest({ id: v.requestId, childId: v.childId, rewardId: v.rewardId, title: v.title, cost: v.cost, now: new Date() }) as unknown as RewardRequestRow;
      for (const [key, data] of requests) {
        if (key[1] !== 'all' && key[1] !== v.childId) continue;
        queryClient.setQueryData<RewardRequestRow[]>(key, [row, ...(data ?? []).filter((r) => r.id !== row.id)]);
      }
      if (balance) queryClient.setQueryData<BalanceSnapshot>(pointKeys.balance(v.childId), { ...balance, reserved: balance.reserved + v.cost, available: balance.available - v.cost });
      return { requests, balance };
    },
    onSuccess: () => show(i18n.t('points.requestSent')),
    onError: (error, v, snap) => {
      for (const [key, data] of snap?.requests ?? []) queryClient.setQueryData(key, data);
      if (snap?.balance) queryClient.setQueryData(pointKeys.balance(v.childId), snap.balance);
      const code = serverErrorCode(error);
      show(code === 'insufficient_balance' ? i18n.t('points.errors.insufficient') : i18n.t('common.error'), 'error');
    },
    onSettled: () => {
      for (const key of ['balance', 'requests', 'transactions']) void queryClient.invalidateQueries({ queryKey: [key] });
    },
  });
}
export const useCancelRequest = () => useInvalidatingMutation((id: string) => cancelRewardRequest(id));
export const useApproveRequest = () => useInvalidatingMutation((id: string) => approveRewardRequest(id));
export const useRejectRequest = () => useInvalidatingMutation(({ id, note }: { id: string; note?: string }) => rejectRewardRequest(id, note));
export const useAdjustPoints = () =>
  useInvalidatingMutation(({ childId, delta, note }: { childId: string; delta: number; note: string }) => adjustPoints(childId, delta, note));
export const useSaveReward = () =>
  useInvalidatingMutation(({ familyId, input, id }: { familyId: string; input: RewardInput; id?: string }) => saveReward(familyId, input, id));
export const useDeleteReward = () => useInvalidatingMutation((id: string) => deleteReward(id));

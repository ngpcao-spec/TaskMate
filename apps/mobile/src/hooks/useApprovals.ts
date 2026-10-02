import { useRequests } from './usePoints';
import { usePendingTasks } from './useTasks';

/** Éléments en attente d'une décision parentale : tâches cochées + demandes d'échange (SPEC §3.10). */
export function useApprovalCounts(enabled: boolean): { tasks: number; requests: number; total: number } {
  const tasks = usePendingTasks(enabled);
  const requests = useRequests(null, enabled);
  const now = new Date();
  const t = enabled ? (tasks.data?.length ?? 0) : 0;
  const r = enabled ? (requests.data ?? []).filter((x) => x.status === 'pending' && new Date(x.expires_at) > now).length : 0;
  return { tasks: t, requests: r, total: t + r };
}

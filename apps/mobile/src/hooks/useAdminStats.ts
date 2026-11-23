import { keepPreviousData, useIsFetching, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchAdminFamilies, fetchAdminFamily, fetchAdminHealth, fetchAdminOverview, fetchAdminSeries, fetchAdminUsage } from '@/api/adminStats';
import { adminStatsKeys } from '@/api/keys';
import type { FamilySort } from '@/domain/admin-stats';

/** Les statistiques se relisent au plus toutes les 5 minutes (bouton « Actualiser » pour forcer) ; aucune relance automatique en cas d'erreur de droits. */
export const ADMIN_STATS_STALE_MS = 5 * 60_000;
const options = { staleTime: ADMIN_STATS_STALE_MS, retry: false } as const;

export const useAdminOverview = () => useQuery({ queryKey: adminStatsKeys.overview, queryFn: fetchAdminOverview, ...options });
export const useAdminSeries = () => useQuery({ queryKey: adminStatsKeys.series, queryFn: fetchAdminSeries, ...options });
export const useAdminUsage = () => useQuery({ queryKey: adminStatsKeys.usage, queryFn: fetchAdminUsage, ...options });
export const useAdminHealth = () => useQuery({ queryKey: adminStatsKeys.health, queryFn: fetchAdminHealth, ...options });
export const useAdminFamilies = (search: string, sort: FamilySort, dir: 'asc' | 'desc', page: number) =>
  useQuery({ queryKey: adminStatsKeys.families(search, sort, dir, page), queryFn: () => fetchAdminFamilies(search, sort, dir, page), placeholderData: keepPreviousData, ...options });
export const useAdminFamily = (familyId: string) => useQuery({ queryKey: adminStatsKeys.family(familyId), queryFn: () => fetchAdminFamily(familyId), enabled: familyId !== '', ...options });

/** « Actualiser » : relit tout le suivi tout de suite ; `busy` tant qu'une lecture est en cours. */
export function useRefreshAdminStats(): { refresh: () => void; busy: boolean } {
  const queryClient = useQueryClient();
  const busy = useIsFetching({ queryKey: adminStatsKeys.all }) > 0;
  return { refresh: () => void queryClient.invalidateQueries({ queryKey: adminStatsKeys.all }), busy };
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchCompanionState, setCompanionStageOffset, setupCompanion } from '@/api/companion';
import { companionKeys } from '@/api/keys';
import type { CompanionState, PandaTrait, StageOffset } from '@/domain/panda';
import i18n from '@/i18n';
import { useToastStore } from '@/store/toast';

/** État du panda d'un enfant (nom, trait, stade, énergie, niveau). `enabled` faux : aucune requête. */
export function useCompanion(childId: string | null | undefined, enabled = true) {
  return useQuery<CompanionState>({
    queryKey: companionKeys.state(childId ?? 'none'),
    queryFn: () => fetchCompanionState(childId as string),
    enabled: enabled && !!childId,
    staleTime: 30_000,
  });
}

function useCompanionMutation<V>(fn: (v: V) => Promise<void>, childIdOf: (v: V) => string) {
  const queryClient = useQueryClient();
  const show = useToastStore((s) => s.show);
  return useMutation<void, unknown, V>({
    networkMode: 'always',
    mutationFn: fn,
    onError: () => show(i18n.t('panda.settings.error'), 'error'),
    onSettled: (_d, _e, v) => void queryClient.invalidateQueries({ queryKey: companionKeys.state(childIdOf(v)) }),
  });
}

/** Réglages du panda : nom et trait (enfant ou parent), décalage de stade (enfant seulement). Écritures en ligne, comme les avatars. */
export const useSetupCompanion = () =>
  useCompanionMutation<{ childId: string; name: string; trait: PandaTrait }>(({ childId, name, trait }) => setupCompanion(childId, name, trait), (v) => v.childId);
export const useSetStageOffset = () =>
  useCompanionMutation<{ childId: string; offset: StageOffset }>(({ childId, offset }) => setCompanionStageOffset(childId, offset), (v) => v.childId);

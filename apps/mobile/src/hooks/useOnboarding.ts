import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/api/keys';
import { fetchOnboarding, hideSetupCard, restartOnboarding, setOnboardingStep } from '@/api/onboarding';
import { onboardingProgress, type OnboardingFacts, type OnboardingProgress, type StepKey } from '@/domain/onboarding';
import { thisDeviceRegistered } from '@/services/webPush';
import { useMe } from '@/hooks/useMe';
import { useToastStore } from '@/store/toast';
import i18n from '@/i18n';

/**
 * Assistant de première connexion (D-090) : état serveur (progression + faits de la famille) ET état de CET appareil (ligne `devices` active, lue de la base).
 * `staleTime: 0` : une étape terminée dans un autre écran doit se voir tout de suite. Réservé au parent (la RPC refuse un enfant).
 */
export function useOnboarding(): { facts: OnboardingFacts | null; progress: OnboardingProgress | null; isPending: boolean; refetch: () => void } {
  const me = useMe().data;
  const isParent = me?.member.role === 'parent';
  const server = useQuery({ queryKey: queryKeys.onboarding, queryFn: fetchOnboarding, enabled: isParent, staleTime: 0, retry: false });
  const device = useQuery({ queryKey: queryKeys.onboardingDevice, queryFn: thisDeviceRegistered, enabled: isParent, staleTime: 0, retry: false });
  // pas de faits tant que l'état de CET appareil n'est pas connu : sinon une famille complète verrait la carte clignoter le temps de la lecture
  const facts: OnboardingFacts | null = server.data && !device.isPending ? { ...server.data, deviceActive: device.data === true } : null;
  return {
    facts,
    progress: facts ? onboardingProgress(facts) : null,
    isPending: isParent === true && (server.isPending || device.isPending),
    refetch: () => {
      void server.refetch();
      void device.refetch();
    },
  };
}

function useOnboardingMutation<V>(fn: (v: V) => Promise<void>) {
  const queryClient = useQueryClient();
  const show = useToastStore((s) => s.show);
  return useMutation<void, unknown, V>({
    networkMode: 'always',
    mutationFn: fn,
    onError: () => show(i18n.t('common.error'), 'error'),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: queryKeys.onboarding }),
  });
}

export const useOnboardingStep = () => useOnboardingMutation<{ step: StepKey; action: 'confirm' | 'skip' | 'unskip' }>(({ step, action }) => setOnboardingStep(step, action));
export const useHideSetupCard = () => useOnboardingMutation<boolean>((hidden) => hideSetupCard(hidden));
export const useRestartOnboarding = () => useOnboardingMutation<void>(() => restartOnboarding());

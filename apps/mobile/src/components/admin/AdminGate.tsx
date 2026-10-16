import { Redirect } from 'expo-router';
import type { ReactNode } from 'react';
import { ActivityIndicator } from 'react-native';
import { useIsPlatformAdmin } from '@/hooks/useCatalog';
import { useMe } from '@/hooks/useMe';

/**
 * Espace Administration (D-080) : réservé à l'administrateur de la plateforme. Ce contrôle ne sert qu'à masquer l'écran (route protégée, pas seulement
 * l'entrée de menu) ; l'autorité est la BASE : chaque RPC `catalog_*` et l'Edge Function refusent tout autre appelant.
 */
export function AdminGate({ children }: { children: ReactNode }) {
  const me = useMe().data;
  const admin = useIsPlatformAdmin();
  if (!me) return null;
  if (me.member.role !== 'parent') return <Redirect href="/" />;
  if (admin.isPending) return <ActivityIndicator />;
  if (admin.data !== true) return <Redirect href="/" />;
  return <>{children}</>;
}

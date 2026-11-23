import { Redirect, Stack } from 'expo-router';
import { View } from 'react-native';
import { SafeAreaInsetsContext, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { SyncBanner, useSyncBannerVisible } from '@/components/SyncBanner';
import { useEntryRoute } from '@/hooks/useMe';
import { colors } from '@/theme/tokens';

/**
 * Sous-écrans communs (`/more/…` : réglages, enfants, objectifs, points, révisions…), ouverts depuis la V2 (D-114 : la V1 et sa barre d'onglets
 * n'existent plus). Garde : session perdue ou appareil révoqué → retour à l'aiguillage. La marge haute n'est comptée qu'UNE fois — par le bandeau de
 * synchronisation quand il est affiché, sinon par chaque écran (D-106).
 */
export default function MoreLayout() {
  const route = useEntryRoute();
  const insets = useSafeAreaInsets();
  const bannerVisible = useSyncBannerVisible();
  if (route !== 'loading' && route !== '/v2') return <Redirect href="/" />;
  return (
    <View style={{ flex: 1 }}>
      <SafeAreaView edges={bannerVisible ? ['top'] : []} style={{ backgroundColor: colors.background }}>
        <SyncBanner />
      </SafeAreaView>
      <SafeAreaInsetsContext.Provider value={bannerVisible ? { ...insets, top: 0 } : insets}>
        <Stack screenOptions={{ headerShown: false }} />
      </SafeAreaInsetsContext.Provider>
    </View>
  );
}

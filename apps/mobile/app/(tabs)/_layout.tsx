import { Redirect, Tabs, usePathname } from 'expo-router';
import { isV1TabRoot } from '@/domain/ui-version';
import { ChartColumn, EllipsisVertical, House, Calendar } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { SafeAreaInsetsContext, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavBar } from '@/components/NavBar';
import { BottomBarContext } from '@/components/TabInset';
import { NotificationPrompt } from '@/components/NotificationPrompt';
import { SyncBanner, useSyncBannerVisible } from '@/components/SyncBanner';
import { useEntryRoute } from '@/hooks/useMe';
import { useShellEffects } from '@/hooks/useShellEffects';
import { useIsWide } from '@/hooks/useLayout';
import { colors } from '@/theme/tokens';

export default function TabsLayout() {
  const { t } = useTranslation();
  const wide = useIsWide();
  const route = useEntryRoute();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const bannerVisible = useSyncBannerVisible();
  // pastille, temps réel, activité (D-102), reprise (D-103), notifications : communs à la V2 (D-106) ; déjà montés par la V2 quand une famille V2 ouvre un sous-écran V1
  const { approvals } = useShellEffects(route !== '/v2');
  // Garde de routage : session perdue, appareil révoqué ou famille passée en V2 (D-106) → retour à l'aiguillage.
  // D-106 : une famille V2 ouvre les sous-écrans V1 réutilisés (`/more/children`, `/more/settings`…), sans la barre d'onglets V1 ; jamais une racine d'onglet.
  const v2 = route === '/v2';
  if (route !== 'loading' && route !== '/(tabs)/today' && !(v2 && !isV1TabRoot(pathname))) return <Redirect href="/" />;
  return (
    <View style={{ flex: 1 }}>
      {/* D-106 : la marge haute n'est comptée qu'UNE fois — par le bandeau de synchronisation quand il est affiché, sinon par chaque écran (SafeAreaView
          du web ajoute la marge sans tenir compte de sa position : sans cela, avec la barre d'état translucide, les onglets auraient deux marges) */}
      <SafeAreaView edges={bannerVisible ? ['top'] : []} style={{ backgroundColor: colors.background }}>
        <SyncBanner />
      </SafeAreaView>
      <SafeAreaInsetsContext.Provider value={bannerVisible ? { ...insets, top: 0 } : insets}>
      <BottomBarContext.Provider value={!wide}>
      <Tabs tabBar={(props) => (v2 ? null : <NavBar {...props} />)} screenOptions={{ headerShown: false, ...(wide ? { tabBarPosition: 'left' as const } : {}) }}>
        <Tabs.Screen name="today" options={{ title: t('tabs.today'), tabBarIcon: ({ color, size }) => <House color={color} size={size} /> }} />
        <Tabs.Screen name="calendar" options={{ title: t('tabs.calendar'), tabBarIcon: ({ color, size }) => <Calendar color={color} size={size} /> }} />
        <Tabs.Screen name="stats" options={{ title: t('tabs.stats'), tabBarIcon: ({ color, size }) => <ChartColumn color={color} size={size} /> }} />
        <Tabs.Screen name="more" options={{ title: t('tabs.more'), tabBarIcon: ({ color, size }) => <EllipsisVertical color={color} size={size} />, tabBarBadge: approvals.total > 0 ? approvals.total : undefined, tabBarAccessibilityLabel: approvals.total > 0 ? `${t('tabs.more')}, ${t('approvals.badge', { count: approvals.total })}` : t('tabs.more') }} />
      </Tabs>
      </BottomBarContext.Provider>
      </SafeAreaInsetsContext.Provider>
      <NotificationPrompt />
    </View>
  );
}

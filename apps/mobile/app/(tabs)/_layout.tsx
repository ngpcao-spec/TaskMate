import { Redirect, Tabs } from 'expo-router';
import { ChartColumn, EllipsisVertical, House, Calendar } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NavBar } from '@/components/NavBar';
import { BottomBarContext } from '@/components/TabInset';
import { NotificationPrompt } from '@/components/NotificationPrompt';
import { SyncBanner } from '@/components/SyncBanner';
import { useEntryRoute } from '@/hooks/useMe';
import { useShellEffects } from '@/hooks/useShellEffects';
import { useIsWide } from '@/hooks/useLayout';
import { colors } from '@/theme/tokens';

export default function TabsLayout() {
  const { t } = useTranslation();
  const wide = useIsWide();
  const route = useEntryRoute();
  const { approvals } = useShellEffects(); // pastille, temps réel, activité (D-102), reprise (D-103), notifications : communs à la V2 (D-106)
  // Garde de routage : session perdue, appareil révoqué ou famille passée en V2 (D-106) → retour à l'aiguillage.
  if (route !== 'loading' && route !== '/(tabs)/today') return <Redirect href="/" />;
  return (
    <View style={{ flex: 1 }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.background }}>
        <SyncBanner />
      </SafeAreaView>
      <BottomBarContext.Provider value={!wide}>
      <Tabs tabBar={(props) => <NavBar {...props} />} screenOptions={{ headerShown: false, ...(wide ? { tabBarPosition: 'left' as const } : {}) }}>
        <Tabs.Screen name="today" options={{ title: t('tabs.today'), tabBarIcon: ({ color, size }) => <House color={color} size={size} /> }} />
        <Tabs.Screen name="calendar" options={{ title: t('tabs.calendar'), tabBarIcon: ({ color, size }) => <Calendar color={color} size={size} /> }} />
        <Tabs.Screen name="stats" options={{ title: t('tabs.stats'), tabBarIcon: ({ color, size }) => <ChartColumn color={color} size={size} /> }} />
        <Tabs.Screen name="more" options={{ title: t('tabs.more'), tabBarIcon: ({ color, size }) => <EllipsisVertical color={color} size={size} />, tabBarBadge: approvals.total > 0 ? approvals.total : undefined, tabBarAccessibilityLabel: approvals.total > 0 ? `${t('tabs.more')}, ${t('approvals.badge', { count: approvals.total })}` : t('tabs.more') }} />
      </Tabs>
      </BottomBarContext.Provider>
      <NotificationPrompt />
    </View>
  );
}

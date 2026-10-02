import { Redirect, Tabs } from 'expo-router';
import { ChartColumn, EllipsisVertical, House, Calendar } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SyncBanner } from '@/components/SyncBanner';
import { useEntryRoute, useMe } from '@/hooks/useMe';
import { useApprovalCounts } from '@/hooks/useApprovals';
import { useIsWide } from '@/hooks/useLayout';
import { useNotificationSetup, useReminderSync } from '@/hooks/useNotifications';
import { useRealtimeFamily } from '@/hooks/useRealtimeFamily';
import { colors } from '@/theme/tokens';

export default function TabsLayout() {
  const { t } = useTranslation();
  const wide = useIsWide();
  const route = useEntryRoute();
  const familyId = useMe().data?.family.id ?? null;
  const isParent = useMe().data?.member.role === 'parent';
  const approvals = useApprovalCounts(isParent);
  useRealtimeFamily(familyId);
  useNotificationSetup();
  useReminderSync();
  // Garde de routage : session perdue ou appareil révoqué → retour à l'onboarding.
  if (route !== 'loading' && route !== '/(tabs)/today') return <Redirect href="/" />;
  return (
    <View style={{ flex: 1 }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.background }}>
        <SyncBanner />
      </SafeAreaView>
      <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.textSecondary, tabBarLabelStyle: { fontSize: 11, fontWeight: '500' }, ...(wide ? { tabBarPosition: 'left' as const, tabBarVariant: 'material' as const, tabBarLabelStyle: { fontSize: 15, fontWeight: '600' as const }, tabBarStyle: { width: 240, paddingTop: 16, borderRightColor: colors.separator } } : { tabBarStyle: { height: 68, paddingTop: 8, paddingBottom: 10, borderTopColor: colors.separator } }) }}>
        <Tabs.Screen name="today" options={{ title: t('tabs.today'), tabBarIcon: ({ color, size }) => <House color={color} size={size} /> }} />
        <Tabs.Screen name="calendar" options={{ title: t('tabs.calendar'), tabBarIcon: ({ color, size }) => <Calendar color={color} size={size} /> }} />
        <Tabs.Screen name="stats" options={{ title: t('tabs.stats'), tabBarIcon: ({ color, size }) => <ChartColumn color={color} size={size} /> }} />
        <Tabs.Screen name="more" options={{ title: t('tabs.more'), tabBarIcon: ({ color, size }) => <EllipsisVertical color={color} size={size} />, tabBarBadge: approvals.total > 0 ? approvals.total : undefined, tabBarAccessibilityLabel: approvals.total > 0 ? `${t('tabs.more')}, ${t('approvals.badge', { count: approvals.total })}` : t('tabs.more') }} />
      </Tabs>
    </View>
  );
}

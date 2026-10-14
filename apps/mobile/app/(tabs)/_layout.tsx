import { Redirect, Tabs } from 'expo-router';
import { useEffect, useState } from 'react';
import { ChartColumn, EllipsisVertical, House, Calendar } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NavBar } from '@/components/NavBar';
import { TabInsetContext } from '@/components/TabInset';
import { NotificationPrompt } from '@/components/NotificationPrompt';
import { SyncBanner } from '@/components/SyncBanner';
import { useEntryRoute, useMe } from '@/hooks/useMe';
import { useApprovalCounts } from '@/hooks/useApprovals';
import { useIsWide } from '@/hooks/useLayout';
import { useNotificationSetup, useReminderSync, useUnreadNotifications } from '@/hooks/useNotifications';
import { badgeTotal } from '@/domain/notification-center';
import { setAppBadge } from '@/pwa/appBadge';
import { useRealtimeFamily } from '@/hooks/useRealtimeFamily';
import { colors } from '@/theme/tokens';

export default function TabsLayout() {
  const { t } = useTranslation();
  const wide = useIsWide();
  const [barHeight, setBarHeight] = useState(0);
  const route = useEntryRoute();
  const familyId = useMe().data?.family.id ?? null;
  const isParent = useMe().data?.member.role === 'parent';
  const approvals = useApprovalCounts(isParent);
  const unread = useUnreadNotifications();
  const badge = badgeTotal(unread, approvals.total);
  useEffect(() => setAppBadge(badge), [badge]);
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
      <TabInsetContext.Provider value={wide ? 0 : barHeight}>
      <Tabs tabBar={(props) => <NavBar {...props} onHeight={setBarHeight} />} screenOptions={{ headerShown: false, ...(wide ? { tabBarPosition: 'left' as const } : {}) }}>
        <Tabs.Screen name="today" options={{ title: t('tabs.today'), tabBarIcon: ({ color, size }) => <House color={color} size={size} /> }} />
        <Tabs.Screen name="calendar" options={{ title: t('tabs.calendar'), tabBarIcon: ({ color, size }) => <Calendar color={color} size={size} /> }} />
        <Tabs.Screen name="stats" options={{ title: t('tabs.stats'), tabBarIcon: ({ color, size }) => <ChartColumn color={color} size={size} /> }} />
        <Tabs.Screen name="more" options={{ title: t('tabs.more'), tabBarIcon: ({ color, size }) => <EllipsisVertical color={color} size={size} />, tabBarBadge: approvals.total > 0 ? approvals.total : undefined, tabBarAccessibilityLabel: approvals.total > 0 ? `${t('tabs.more')}, ${t('approvals.badge', { count: approvals.total })}` : t('tabs.more') }} />
      </Tabs>
      </TabInsetContext.Provider>
      <NotificationPrompt />
    </View>
  );
}

import { Redirect, Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SyncBanner } from '@/components/SyncBanner';
import { useEntryRoute, useMe } from '@/hooks/useMe';
import { useRealtimeFamily } from '@/hooks/useRealtimeFamily';
import { colors } from '@/theme/tokens';

export default function TabsLayout() {
  const { t } = useTranslation();
  const route = useEntryRoute();
  const familyId = useMe().data?.family.id ?? null;
  useRealtimeFamily(familyId);
  // Garde de routage : session perdue ou appareil révoqué → retour à l'onboarding.
  if (route !== 'loading' && route !== '/(tabs)/today') return <Redirect href="/" />;
  return (
    <View style={{ flex: 1 }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.background }}>
        <SyncBanner />
      </SafeAreaView>
      <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.primary }}>
        <Tabs.Screen name="today" options={{ title: t('tabs.today') }} />
        <Tabs.Screen name="calendar" options={{ title: t('tabs.calendar') }} />
        <Tabs.Screen name="stats" options={{ title: t('tabs.stats') }} />
        <Tabs.Screen name="more" options={{ title: t('tabs.more') }} />
      </Tabs>
    </View>
  );
}

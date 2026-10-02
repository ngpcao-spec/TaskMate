import { Redirect, Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useEntryRoute } from '@/hooks/useMe';
import { colors } from '@/theme/tokens';

export default function TabsLayout() {
  const { t } = useTranslation();
  const route = useEntryRoute();
  // Garde de routage : session perdue ou appareil révoqué → retour à l'onboarding.
  if (route !== 'loading' && route !== '/(tabs)/today') return <Redirect href="/" />;
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.primary }}>
      <Tabs.Screen name="today" options={{ title: t('tabs.today') }} />
      <Tabs.Screen name="calendar" options={{ title: t('tabs.calendar') }} />
      <Tabs.Screen name="stats" options={{ title: t('tabs.stats') }} />
      <Tabs.Screen name="more" options={{ title: t('tabs.more') }} />
    </Tabs>
  );
}

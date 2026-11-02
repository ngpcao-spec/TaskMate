import { Redirect, Tabs } from 'expo-router';
import { BookOpen, CalendarDays, House, Settings, Star } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useApprovalCounts } from '@/hooks/useApprovals';
import { useMe } from '@/hooks/useMe';
import { V2TabBar, type V2Tab } from '@/v2/components/V2TabBar';

const ICONS = { home: House, calendar: CalendarDays, review: BookOpen, rewards: Star, settings: Settings } as const;
type TabName = keyof typeof ICONS;
const isTab = (n: string): n is TabName => n in ICONS;

/** Onglets du parent (V2, D-106) : Hôm nay, Lịch, Ôn tập, Phần thưởng, Cài đặt. Un enfant est renvoyé à `/v2`. */
export default function V2ParentLayout() {
  const { t } = useTranslation();
  const me = useMe().data;
  const isParent = me?.member.role === 'parent';
  const counts = useApprovalCounts(isParent);
  if (me && !isParent) return <Redirect href="/v2" />;
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={({ state, navigation }) => (
        <V2TabBar
          tabs={state.routes.filter((r) => isTab(r.name)).map((r): V2Tab => {
            const name = r.name as TabName;
            return {
              key: name,
              label: t(`v2.tabs.${name === 'home' ? 'home' : name}`),
              Icon: ICONS[name],
              active: state.routes[state.index]?.key === r.key,
              badge: name === 'home' && counts.tasks > 0 ? counts.tasks : name === 'rewards' && counts.requests > 0 ? counts.requests : undefined,
              onPress: () => navigation.navigate(r.name),
            };
          })}
        />
      )}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="calendar" />
      <Tabs.Screen name="review" />
      <Tabs.Screen name="rewards" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}

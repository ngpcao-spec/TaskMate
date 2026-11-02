import { Redirect, Tabs } from 'expo-router';
import { ChartColumn, House, Map as MapIcon, Star, UserRound } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useAdventure } from '@/hooks/useAdventure';
import { useMe } from '@/hooks/useMe';
import { V2TabBar, type V2Tab } from '@/v2/components/V2TabBar';

const ICONS = { home: House, rewards: Star, adventure: MapIcon, stats: ChartColumn, me: UserRound } as const;
type TabName = keyof typeof ICONS;
const isTab = (n: string): n is TabName => n in ICONS;

/** Onglets de l'enfant (V2, D-106) : Hôm nay, Phần thưởng, Phiêu lưu (pastille quand une trouvaille attend), Thống kê, Tôi. Un parent est renvoyé à `/v2`. */
export default function V2ChildLayout() {
  const { t } = useTranslation();
  const me = useMe().data;
  const childId = me?.member.role === 'child' ? me.member.child_id : null;
  const adventure = useAdventure(childId, !!childId).data;
  if (me && me.member.role !== 'child') return <Redirect href="/v2" />;
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={({ state, navigation }) => (
        <V2TabBar
          tabs={state.routes.filter((r) => isTab(r.name)).map((r): V2Tab => {
            const name = r.name as TabName;
            return {
              key: name,
              label: t(`v2.tabs.${name}`),
              Icon: ICONS[name],
              active: state.routes[state.index]?.key === r.key,
              badge: name === 'adventure' && adventure?.state === 'back' ? 1 : undefined,
              onPress: () => navigation.navigate(r.name),
            };
          })}
        />
      )}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="rewards" />
      <Tabs.Screen name="adventure" />
      <Tabs.Screen name="stats" />
      <Tabs.Screen name="me" />
    </Tabs>
  );
}

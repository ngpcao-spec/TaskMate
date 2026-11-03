import { Redirect, Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAdventure } from '@/hooks/useAdventure';
import { useMe } from '@/hooks/useMe';
import { useHomeScene } from '@/store/homeScene';
import type { TabStickerName } from '@/v2/components/TabSticker';
import { V2TabBar, type V2Tab } from '@/v2/components/V2TabBar';

/** icône « autocollant » de chaque onglet (dessins originaux, `TabSticker`) */
const ICONS = { home: 'home', rewards: 'rewards', adventure: 'adventure', stats: 'stats', me: 'me' } as const satisfies Record<string, TabStickerName>;
type TabName = keyof typeof ICONS;
const isTab = (n: string): n is TabName => n in ICONS;

/** Onglets de l'enfant (V2, D-106) : Hôm nay, Phần thưởng, Phiêu lưu (pastille quand une trouvaille attend), Thống kê, Tôi. Un parent est renvoyé à `/v2`. */
export default function V2ChildLayout() {
  const { t } = useTranslation();
  const me = useMe().data;
  const childId = me?.member.role === 'child' ? me.member.child_id : null;
  const adventure = useAdventure(childId, !!childId).data;
  const sceneColor = useHomeScene((s) => s.color);
  if (me && me.member.role !== 'child') return <Redirect href="/v2" />;
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={({ state, navigation }) => (
        <V2TabBar
          sceneColor={sceneColor}
          tabs={state.routes.filter((r) => isTab(r.name)).map((r): V2Tab => {
            const name = r.name as TabName;
            return {
              key: name,
              label: t(`v2.tabs.${name}`),
              sticker: ICONS[name],
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

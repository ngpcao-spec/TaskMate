import type { LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { v2Colors, v2Font, v2Shadow, v2Spacing, V2_TOUCH } from '../theme';

export type V2Tab = { key: string; label: string; Icon: LucideIcon; active: boolean; onPress: () => void; badge?: number };

/**
 * Barre d'onglets V2 : 5 onglets, icône + libellé, pastille (ex. trouvaille qui attend).
 * `sceneColor` (Hôm nay enfant avec la vidéo d'accueil, D-106) : la barre prend cette couleur, sans coins arrondis ni ombre, pour prolonger la vidéo
 * jusqu'en bas de l'écran ; icônes et libellés passent aux teintes foncées `tabActiveOnScene` / `tabInactiveOnScene` (contraste ≥ 4,5:1).
 */
export function V2TabBar({ tabs, sceneColor = null }: { tabs: V2Tab[]; sceneColor?: string | null }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <View
      accessibilityRole="tablist"
      testID="v2-tabbar"
      style={[styles.bar, { paddingBottom: Math.max(insets.bottom, v2Spacing.sm) }, sceneColor ? { backgroundColor: sceneColor, borderTopLeftRadius: 0, borderTopRightRadius: 0, shadowOpacity: 0, elevation: 0, boxShadow: 'none' } : null]}
    >
      {tabs.map((tab) => {
        const color = sceneColor ? (tab.active ? v2Colors.tabActiveOnScene : v2Colors.tabInactiveOnScene) : tab.active ? v2Colors.tabActive : v2Colors.tabInactive;
        const label = tab.badge ? t('v2.tabs.badge', { label: tab.label, count: tab.badge }) : tab.label;
        return (
          <Pressable key={tab.key} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: tab.active }} onPress={tab.onPress} style={styles.tab} testID={`v2-tab-${tab.key}`}>
            <View>
              <tab.Icon size={24} color={color} strokeWidth={tab.active ? 2.6 : 2} />
              {tab.badge ? <View style={styles.dot} /> : null}
            </View>
            <Text style={[styles.label, { color }]} numberOfLines={1}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', backgroundColor: v2Colors.tabBar, paddingTop: v2Spacing.sm, borderTopLeftRadius: 24, borderTopRightRadius: 24, ...v2Shadow },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: V2_TOUCH + 8, gap: 2 },
  label: v2Font(700, 11),
  dot: { position: 'absolute', top: -2, right: -6, width: 10, height: 10, borderRadius: 5, backgroundColor: v2Colors.badge },
});

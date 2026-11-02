import type { LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { v2Colors, v2Font, v2Shadow, v2Spacing, V2_TOUCH } from '../theme';

export type V2Tab = { key: string; label: string; Icon: LucideIcon; active: boolean; onPress: () => void; badge?: number };

/** Barre d'onglets V2 : 5 onglets, icône + libellé, pastille (ex. trouvaille qui attend). */
export function V2TabBar({ tabs }: { tabs: V2Tab[] }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <View accessibilityRole="tablist" style={[styles.bar, { paddingBottom: Math.max(insets.bottom, v2Spacing.sm) }]}>
      {tabs.map((tab) => {
        const color = tab.active ? v2Colors.tabActive : v2Colors.tabInactive;
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

import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { v2Colors, v2Font, v2Shadow, v2Spacing, V2_TOUCH } from '../theme';
import { TabSticker, type TabStickerName } from './TabSticker';

export type V2Tab = { key: string; label: string; sticker: TabStickerName; active: boolean; onPress: () => void; badge?: number };

/** Taille des icônes « autocollant » (pt). */
export const TAB_STICKER_SIZE = 38;

/**
 * Barre d'onglets V2 (D-106) : icônes « autocollant » en couleur (dessins originaux, `TabSticker`), libellé en gras dessous, onglet actif posé sur
 * un carré clair arrondi, pastille numérotée (carré arrondi rouge à contour blanc, « 9+ » au-delà) en haut à droite de l'icône.
 * `sceneColor` (Hôm nay enfant avec la vidéo d'accueil) : la barre prend cette couleur, sans coins arrondis ni ombre, pour prolonger la vidéo jusqu'en
 * bas de l'écran ; libellés et carré actif passent aux teintes `…OnScene` (contraste ≥ 4,5:1, vérifié par test).
 */
export function V2TabBar({ tabs, sceneColor = null }: { tabs: V2Tab[]; sceneColor?: string | null }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const onScene = !!sceneColor;
  return (
    <View
      accessibilityRole="tablist"
      testID="v2-tabbar"
      style={[styles.bar, { paddingBottom: Math.max(insets.bottom, v2Spacing.sm) }, onScene ? { backgroundColor: sceneColor, borderTopLeftRadius: 0, borderTopRightRadius: 0, shadowOpacity: 0, elevation: 0, boxShadow: 'none' } : null]}
    >
      {tabs.map((tab) => {
        const color = onScene ? (tab.active ? v2Colors.tabActiveOnScene : v2Colors.tabInactiveOnScene) : tab.active ? v2Colors.tabActive : v2Colors.tabInactive;
        const label = tab.badge ? t('v2.tabs.badge', { label: tab.label, count: tab.badge }) : tab.label;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected: tab.active }}
            onPress={tab.onPress}
            style={({ pressed }) => [styles.tab, pressed ? styles.pressed : null]}
            testID={`v2-tab-${tab.key}`}
          >
            <View
              testID={`v2-tab-${tab.key}-tile`}
              style={[styles.tile, tab.active ? { backgroundColor: onScene ? v2Colors.tabActiveBgOnScene : v2Colors.tabActiveBg } : null]}
            >
              <View>
                <TabSticker name={tab.sticker} size={TAB_STICKER_SIZE} />
                {tab.badge ? (
                  <View style={styles.badge} testID={`v2-tab-${tab.key}-badge`} importantForAccessibility="no-hide-descendants">
                    <Text style={styles.badgeText}>{tab.badge > 9 ? '9+' : tab.badge}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.label, { color }]} numberOfLines={1}>
                {tab.label}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', backgroundColor: v2Colors.tabBar, paddingTop: v2Spacing.sm, paddingHorizontal: v2Spacing.xs, borderTopLeftRadius: 24, borderTopRightRadius: 24, ...v2Shadow },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: V2_TOUCH + 16 },
  pressed: { transform: [{ scale: 0.94 }] },
  // carré clair de l'onglet actif (Finch) ; les autres onglets gardent la même place, sans fond
  tile: { alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: v2Spacing.xs + 2, paddingHorizontal: v2Spacing.xs, borderRadius: 16, alignSelf: 'stretch', marginHorizontal: 2 },
  label: v2Font(800, 12),
  badge: {
    position: 'absolute',
    top: -6,
    right: -12,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 4,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: v2Colors.badgeRing,
    backgroundColor: v2Colors.badge,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { ...v2Font(800, 12), color: v2Colors.onBadge },
});

import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { sceneImage } from '../images';
import { v2Colors, v2Font, v2Radius, v2Shadow, v2Spacing, V2_TOUCH } from '../theme';

export type TopButton = { key: string; Icon: LucideIcon; label: string; onPress: () => void; badge?: number };

type Props = {
  /** décor : `home` (bambouseraie) ou le slug d'une destination ; inconnu = maison */
  scene: string;
  height: number;
  left?: TopButton[];
  right?: TopButton[];
  /** le panda (posé sur le sol, au centre du décor) */
  children?: ReactNode;
  testID?: string;
};

function RoundTop({ b }: { b: TopButton }) {
  const label = b.badge ? `${b.label} (${b.badge})` : b.label;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={b.onPress} style={({ pressed }) => [styles.btn, pressed ? styles.pressed : null]} testID={`v2-top-${b.key}`}>
      <b.Icon size={22} color={v2Colors.onTopButton} />
      {b.badge ? (
        <View style={styles.badge} importantForAccessibility="no-hide-descendants">
          <Text style={styles.badgeText}>{b.badge > 9 ? '9+' : b.badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/** En-tête V2 : décor plein cadre (ciel en haut, sol libre au centre), boutons ronds du haut, panda posé sur le sol. */
export function SceneHeader({ scene, height, left = [], right = [], children, testID }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View testID={testID} style={[styles.wrap, { height: height + insets.top }]}>
      <Image source={sceneImage(scene)} resizeMode="cover" style={StyleSheet.absoluteFill} accessibilityIgnoresInvertColors importantForAccessibility="no" testID={`v2-scene-${scene}`} />
      <View style={[styles.top, { paddingTop: insets.top + v2Spacing.sm }]}>
        <View style={styles.group}>{left.map((b) => <RoundTop key={b.key} b={b} />)}</View>
        <View style={styles.group}>{right.map((b) => <RoundTop key={b.key} b={b} />)}</View>
      </View>
      <View style={styles.ground}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', overflow: 'hidden', backgroundColor: v2Colors.backgroundDeep, borderBottomLeftRadius: v2Radius.card, borderBottomRightRadius: v2Radius.card },
  top: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: v2Spacing.lg },
  group: { flexDirection: 'row', gap: v2Spacing.sm },
  btn: { width: V2_TOUCH, height: V2_TOUCH, borderRadius: V2_TOUCH / 2, backgroundColor: v2Colors.topButton, alignItems: 'center', justifyContent: 'center', ...v2Shadow },
  pressed: { transform: [{ scale: 0.94 }] },
  badge: { position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: v2Colors.badge, alignItems: 'center', justifyContent: 'center' },
  badgeText: { ...v2Font(800, 11), color: v2Colors.onBadge },
  // sol : bas du décor, où le panda marche
  ground: { position: 'absolute', left: v2Spacing.lg, right: v2Spacing.lg, bottom: v2Spacing.xl },
});

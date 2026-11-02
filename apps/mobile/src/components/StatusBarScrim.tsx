import { useId } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { STATUS_SCRIM } from '@/domain/status-bar';

/**
 * Voile sombre sous la barre d'état translucide de la PWA iPhone (D-106) : monté UNE fois à la racine, au-dessus de tous les écrans V1 et V2, sans capter
 * les touches. Web seulement (le natif gère sa barre d'état) et seulement s'il y a une marge haute. Couleur = jeton du thème actif (`statusScrim`).
 */
export function StatusBarScrim({ color }: { color: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const top = useSafeAreaInsets().top;
  if (Platform.OS !== 'web' || top <= 0) return null;
  const height = top + STATUS_SCRIM.fadeBelow;
  return (
    <View testID="status-bar-scrim" pointerEvents="none" aria-hidden importantForAccessibility="no-hide-descendants" style={[styles.wrap, { height }]}>
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={STATUS_SCRIM.top} />
            <Stop offset={top / height} stopColor={color} stopOpacity={STATUS_SCRIM.insetBottom} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({ wrap: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1000 } });

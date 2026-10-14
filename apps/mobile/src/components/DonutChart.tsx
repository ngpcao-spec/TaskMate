import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors } from '@/theme/tokens';

export type Segment = { key: string; value: number; color: string };

/** Anneau segmenté de la maquette (« Top Genres ») : un arc par catégorie, séparés par un fin intervalle. Décoratif (la légende porte le texte). */
export function DonutChart({ segments, size = 148, stroke = 30 }: { segments: readonly Segment[]; size?: number; stroke?: number }) {
  const total = segments.reduce((n, s) => n + s.value, 0);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const gap = total > 0 && segments.filter((s) => s.value > 0).length > 1 ? 3 : 0;
  let offset = 0;
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.35)" strokeWidth={stroke} fill="none" />
        {total === 0
          ? null
          : segments
              .filter((s) => s.value > 0)
              .map((s) => {
                const len = (s.value / total) * c;
                const dash = Math.max(len - gap, 0.5);
                const node = (
                  <Circle
                    key={s.key}
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    stroke={s.color}
                    strokeWidth={stroke}
                    fill="none"
                    strokeDasharray={`${dash} ${c - dash}`}
                    strokeDashoffset={-offset}
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                  />
                );
                offset += len;
                return node;
              })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 999, backgroundColor: 'transparent', borderColor: colors.glassBorderSoft },
});

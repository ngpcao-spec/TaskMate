import { StyleSheet, Text, View } from 'react-native';
import { colors, shadowInset, line, chartTones } from '@/theme/tokens';

export type Bar = { key: string; label: string; done: number; total: number; accessibilityLabel: string };

const PLOT_HEIGHT = 132;

/**
 * Barres verticales de la maquette (« Listening Overview ») : une gouttière en creux par période (hauteur = nombre de tâches),
 * remplie de bas en haut par les tâches faites, teintes variées. Échelle commune ; axe gauche 0 / milieu / max.
 */
export function BarChart({ bars }: { bars: readonly Bar[] }) {
  const max = Math.max(1, ...bars.map((b) => b.total));
  const mid = Math.ceil(max / 2);
  return (
    <View style={styles.wrap}>
      <View style={styles.axis} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {[max, mid, 0].map((v, i) => (
          <Text key={`${v}-${i}`} style={styles.tick}>{v}</Text>
        ))}
      </View>
      <View style={styles.plot}>
        {bars.map((b, i) => (
          <View key={b.key} accessible accessibilityLabel={b.accessibilityLabel} style={styles.col}>
            <View style={styles.slot}>
              <View style={[styles.groove, { height: Math.max(6, (b.total / max) * PLOT_HEIGHT) }]}>
                <View style={[styles.fill, { height: `${b.total === 0 ? 0 : (b.done / b.total) * 100}%`, backgroundColor: chartTones[i % chartTones.length] }]} />
              </View>
            </View>
            <Text style={styles.label}>{b.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', gap: 8 },
  axis: { height: PLOT_HEIGHT, justifyContent: 'space-between', paddingBottom: 0 },
  tick: { fontSize: 11, color: colors.textSecondary, textAlign: 'right', minWidth: 14 },
  plot: { flex: 1, flexDirection: 'row', gap: 6 },
  col: { flex: 1, alignItems: 'center', gap: 6 },
  slot: { height: PLOT_HEIGHT, width: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  groove: { width: '78%', maxWidth: 30, borderRadius: 10, overflow: 'hidden', justifyContent: 'flex-end', backgroundColor: colors.track, borderWidth: line.width, borderColor: colors.glassBorderSoft, ...shadowInset },
  fill: { width: '100%', borderRadius: 10, borderWidth: line.width, borderColor: colors.ring },
  label: { fontSize: 11, color: colors.text, fontWeight: '600' },
});

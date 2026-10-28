import { StyleSheet, Text, View } from 'react-native';
import type { ChartBar } from '@/domain/admin-stats';
import { chartTones, colors, line, shadowInset } from '@/theme/tokens';

const PLOT_HEIGHT = 120;

const toneColor = (tone: number): string => chartTones[tone % chartTones.length] ?? colors.primary;
/** Segments non vides, du plus haut (enfants) au plus bas (parents). */
/** Style calculé hors du JSX (le plugin Babel de Reanimated plante les tests sur un objet de style littéral lisant `s.value`). */
const segmentStyle = (value: number, tone: number) => ({ flexGrow: value, backgroundColor: toneColor(tone) });
const segmentsOf = (bar: ChartBar) => bar.segments.filter((s) => s.value > 0).slice().reverse();

/**
 * Barres du suivi des utilisateurs (D-102) : une barre par période, jusqu'à deux segments empilés (parents / enfants), échelle commune, axe 0 / milieu / max.
 * Chaque barre porte son libellé d'accessibilité (valeur exacte) : le graphique ne se lit pas seulement à la couleur ni à la hauteur.
 */
export function SeriesChart({ bars, title }: { bars: readonly ChartBar[]; title: string }) {
  const totals = bars.map((b) => b.segments.reduce((sum, s) => sum + s.value, 0));
  const max = Math.max(1, ...totals);
  const mid = Math.ceil(max / 2);
  return (
    <View accessibilityLabel={title} style={styles.wrap}>
      <View style={styles.axis} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {[max, mid, 0].map((v, i) => (
          <Text key={`${v}-${i}`} style={styles.tick}>{v}</Text>
        ))}
      </View>
      <View style={styles.plot}>
        {bars.map((b, i) => (
          <View key={b.key} accessible accessibilityLabel={b.accessibilityLabel} style={styles.col}>
            <View style={styles.slot}>
              <View style={[styles.stack, { height: Math.max(3, ((totals[i] ?? 0) / max) * PLOT_HEIGHT) }]}>
                {segmentsOf(b).map((s) => (
                  <View key={s.tone} style={[styles.segment, segmentStyle(s.value, s.tone)]} />
                ))}
              </View>
            </View>
            <Text numberOfLines={1} style={styles.label}>{b.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', gap: 8 },
  axis: { height: PLOT_HEIGHT, justifyContent: 'space-between' },
  tick: { fontSize: 11, color: colors.textSecondary, textAlign: 'right', minWidth: 18 },
  plot: { flex: 1, flexDirection: 'row', gap: 2 },
  col: { flex: 1, alignItems: 'center', gap: 4 },
  slot: { height: PLOT_HEIGHT, width: '100%', justifyContent: 'flex-end', alignItems: 'center', backgroundColor: colors.track, borderRadius: 4, ...shadowInset },
  segment: { flexBasis: 0 },
  stack: { width: '80%', borderRadius: 3, overflow: 'hidden', justifyContent: 'flex-end', borderWidth: line.width, borderColor: colors.ring },
  label: { fontSize: 9, color: colors.text, fontWeight: '600', minHeight: 12 },
});

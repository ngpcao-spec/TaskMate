import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GlassTile } from '@/components/GlassTile';
import { colors, radius, shadow, line } from '@/theme/tokens';

type Props = {
  icon: ReactNode;
  label: string;
  value: string;
  caption?: string;
  /** Teinte de la tuile (maquette : sarcelle, bleu acier, givre, violet). */
  tint: string;
  accessibilityLabel?: string;
};

/** Tuile de chiffre clé (maquette « Songs Played 1,248 +16 % this week ») : icône en relief, libellé, grand nombre, légende. */
export function StatTile({ icon, label, value, caption, tint, accessibilityLabel }: Props) {
  return (
    <View accessible accessibilityLabel={accessibilityLabel ?? `${label}: ${value}${caption ? `, ${caption}` : ''}`} style={[styles.tile, { backgroundColor: tint }]}>
      <GlassTile size={44}>{icon}</GlassTile>
      <Text numberOfLines={2} style={styles.label}>{label}</Text>
      <Text numberOfLines={1} style={styles.value}>{value}</Text>
      {caption ? <Text numberOfLines={2} style={styles.caption}>{caption}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { flexGrow: 1, flexBasis: 100, minHeight: 132, borderRadius: radius.tile, padding: 12, gap: 2, borderWidth: line.width, borderColor: colors.glassBorder, ...shadow },
  label: { fontSize: 12, fontWeight: '600', color: colors.text, marginTop: 6, minHeight: 30 },
  value: { fontSize: 26, fontWeight: '800', color: colors.text },
  caption: { fontSize: 12, color: colors.textSecondary },
});

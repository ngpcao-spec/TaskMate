import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, shadowSmall, line } from '@/theme/tokens';

type Props = { children: ReactNode; size?: number; tint?: string; style?: StyleProp<ViewStyle> };

/** Tuile d'icône carrée arrondie en relief (maquette : icône dans un carré givré à reflet clair). Décorative. */
export function GlassTile({ children, size = 44, tint = colors.cardStrong, style }: Props) {
  return (
    <View style={[styles.tile, { width: size, height: size, borderRadius: Math.round(size * 0.32), backgroundColor: tint }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { alignItems: 'center', justifyContent: 'center', borderWidth: line.width, borderColor: colors.glassBorder, ...shadowSmall },
});

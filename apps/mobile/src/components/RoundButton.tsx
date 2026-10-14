import type { ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { colors, MIN_TARGET, shadowSmall } from '@/theme/tokens';

type Props = { label: string; onPress: () => void; children: ReactNode; size?: number; teal?: boolean; disabled?: boolean };

/** Bouton rond en relief (retour, cloche, lecture/coche de la maquette). Cible ≥ 44 pt quel que soit `size`. */
export function RoundButton({ label, onPress, children, size = MIN_TARGET, teal = false, disabled = false }: Props) {
  const box = Math.max(size, MIN_TARGET);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.round, { width: box, height: box, borderRadius: box / 2 }, teal ? styles.teal : styles.glass, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  round: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, ...shadowSmall },
  glass: { backgroundColor: colors.cardStrong, borderColor: colors.glassBorder },
  teal: { backgroundColor: colors.primary, borderColor: colors.ring },
  pressed: { opacity: 0.85 },
});

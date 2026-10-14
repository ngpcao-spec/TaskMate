import type { ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { colors, MIN_TARGET, shadowSmall } from '@/theme/tokens';

/** Choix d'icône (récompense / objectif) : pastille avec l'icône, nom technique en libellé d'accessibilité. */
export function IconChoice({ name, selected, onPress, children }: { name: string; selected: boolean; onPress: () => void; children: ReactNode }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={name}
      accessibilityState={{ selected, checked: selected }}
      aria-checked={selected}
      onPress={onPress}
      style={[styles.choice, selected && styles.selected]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  choice: { width: MIN_TARGET + 4, height: MIN_TARGET + 4, borderRadius: (MIN_TARGET + 4) / 2, borderWidth: 1, borderColor: colors.glassBorder, backgroundColor: colors.cardStrong, alignItems: 'center', justifyContent: 'center', ...shadowSmall },
  selected: { borderColor: colors.primary, borderWidth: 2.5, backgroundColor: colors.primaryTint },
});

import type { ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { colors, MIN_TARGET } from '@/theme/tokens';

/** Choix d'icône (récompense / objectif) : pastille avec l'icône, nom technique en libellé d'accessibilité. */
export function IconChoice({ name, selected, onPress, children }: { name: string; selected: boolean; onPress: () => void; children: ReactNode }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={name}
      accessibilityState={{ selected, checked: selected }}
      onPress={onPress}
      style={[styles.choice, selected && styles.selected]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  choice: { width: MIN_TARGET + 4, height: MIN_TARGET + 4, borderRadius: (MIN_TARGET + 4) / 2, borderWidth: 1.5, borderColor: '#D5DFEC', backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  selected: { borderColor: colors.primary, backgroundColor: '#E8F1FE' },
});

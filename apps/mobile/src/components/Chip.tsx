import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, MIN_TARGET, radius, shadowSmall } from '@/theme/tokens';

type Props = { label: string; selected: boolean; onPress: () => void; color?: string; role?: 'radio' | 'checkbox' };

/** Pastille de choix : verre en relief au repos, pleine couleur (sarcelle par défaut) quand elle est choisie. */
export function Chip({ label, selected, onPress, color = colors.primary, role = 'radio' }: Props) {
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityState={{ selected, checked: selected }}
      aria-checked={selected}
      onPress={onPress}
      style={[styles.chip, selected && { backgroundColor: color, borderColor: 'rgba(255,255,255,0.5)' }]}
    >
      <Text style={[styles.text, selected && styles.textSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { minHeight: MIN_TARGET, paddingHorizontal: 18, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.glassBorder, backgroundColor: colors.cardStrong, justifyContent: 'center', ...shadowSmall },
  text: { fontSize: 14, fontWeight: '600', color: colors.text },
  textSelected: { color: '#fff' },
});

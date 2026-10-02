import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, MIN_TARGET, radius } from '@/theme/tokens';

type Props = { label: string; selected: boolean; onPress: () => void; color?: string; role?: 'radio' | 'checkbox' };

export function Chip({ label, selected, onPress, color = colors.primary, role = 'radio' }: Props) {
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityState={{ selected, checked: selected }}
      onPress={onPress}
      style={[styles.chip, selected && { backgroundColor: color, borderColor: color }]}
    >
      <Text style={[styles.text, selected && styles.textSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { minHeight: MIN_TARGET, paddingHorizontal: 16, borderRadius: radius.pill, borderWidth: 1.5, borderColor: '#D5DFEC', backgroundColor: colors.card, justifyContent: 'center' },
  text: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  textSelected: { color: '#fff' },
});

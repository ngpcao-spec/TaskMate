import { Check, X } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, MIN_TARGET, radius } from '@/theme/tokens';

type Props = {
  label: string;
  selected?: boolean;
  /** Retour d'entraînement : juste / faux / neutre. */
  mark?: 'correct' | 'wrong' | null;
  disabled?: boolean;
  onPress?: () => void;
};

/** Un choix de réponse (cible ≥ 44 pt, rôle « radio »). Le retour (✓ / ✗) n'est jamais porté par la seule couleur. */
export function ChoiceButton({ label, selected = false, mark = null, disabled = false, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected, checked: selected, disabled }}
      aria-checked={selected}
      disabled={disabled}
      onPress={onPress}
      style={[styles.choice, selected && styles.selected, mark === 'correct' && styles.correct, mark === 'wrong' && styles.wrong]}
    >
      <Text style={styles.text}>{label}</Text>
      {mark === 'correct' ? <Check color={colors.success} size={20} /> : null}
      {mark === 'wrong' ? <X color={colors.danger} size={20} /> : null}
      {mark === null && selected ? <View style={styles.dot} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  choice: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: MIN_TARGET + 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.card, borderWidth: 1.5, borderColor: '#D5DFEC', backgroundColor: colors.card },
  selected: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  correct: { borderColor: colors.success, backgroundColor: colors.successTint },
  wrong: { borderColor: colors.danger, backgroundColor: '#FDECEC' },
  text: { flex: 1, fontSize: 16, color: colors.text },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary },
});

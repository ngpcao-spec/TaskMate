import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, MIN_TARGET, radius } from '@/theme/tokens';

type Props = {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onPress?: () => void;
};

/** Un choix de réponse (cible ≥ 44 pt, rôle « radio »). Aucun retour juste/faux : l'enfant ne connaît jamais la bonne réponse pendant les questions. */
export function ChoiceButton({ label, selected = false, disabled = false, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected, checked: selected, disabled }}
      aria-checked={selected}
      disabled={disabled}
      onPress={onPress}
      style={[styles.choice, selected && styles.selected]}
    >
      <Text style={styles.text}>{label}</Text>
      {selected ? <View style={styles.dot} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  choice: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: MIN_TARGET + 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.card, borderWidth: 1.5, borderColor: '#D5DFEC', backgroundColor: colors.card },
  selected: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  text: { flex: 1, fontSize: 16, color: colors.text },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary },
});

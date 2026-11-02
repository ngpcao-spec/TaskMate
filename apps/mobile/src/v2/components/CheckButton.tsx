import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';
import { v2Colors, V2_TOUCH } from '../theme';

type Props = {
  checked: boolean;
  /** libellé lu par les lecteurs d'écran (le titre de l'objectif) */
  label: string;
  onPress: () => void;
  disabled?: boolean;
  size?: number;
};

/** Gros bouton rond ✓ (≥ 44 pt) : vide = à faire, plein vert = coché. */
export function CheckButton({ checked, label, onPress, disabled = false, size = 52 }: Props) {
  const s = Math.max(size, V2_TOUCH);
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [
        styles.base,
        { width: s, height: s, borderRadius: s / 2 },
        checked ? styles.checked : styles.empty,
        pressed && !disabled ? styles.pressed : null,
        disabled ? styles.disabled : null,
      ]}
    >
      {checked ? <Check size={Math.round(s * 0.55)} color={v2Colors.onPrimary} strokeWidth={3.5} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', borderWidth: 3 },
  empty: { backgroundColor: v2Colors.card, borderColor: v2Colors.line },
  checked: { backgroundColor: v2Colors.primary, borderColor: v2Colors.primary },
  pressed: { transform: [{ scale: 0.94 }] },
  disabled: { opacity: 0.6 },
});

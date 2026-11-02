import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { v2Colors, v2Radius, v2Spacing, v2Text, V2_TOUCH } from '../theme';

type Props = { label: string; onPress?: () => void; disabled?: boolean; loading?: boolean; variant?: 'primary' | 'secondary' | 'danger'; testID?: string };

/** Bouton V2 en pilule (≥ 44 pt) : vert (action), crème bordé (secondaire), rouge (refus). */
export function V2Button({ label, onPress, disabled = false, loading = false, variant = 'primary', testID }: Props) {
  const off = disabled || loading || !onPress;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: off, busy: loading }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [styles.base, styles[variant], pressed && variant === 'primary' ? styles.pressed : null, off ? styles.off : null]}
    >
      {loading ? <ActivityIndicator color={variant === 'secondary' ? v2Colors.primary : v2Colors.onPrimary} /> : <Text style={[styles.text, variant === 'secondary' ? styles.textSecondary : null]}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: Math.max(48, V2_TOUCH), borderRadius: v2Radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: v2Spacing.xl },
  primary: { backgroundColor: v2Colors.primary },
  secondary: { backgroundColor: v2Colors.card, borderWidth: 2, borderColor: v2Colors.primary },
  danger: { backgroundColor: v2Colors.danger },
  pressed: { backgroundColor: v2Colors.primaryPressed },
  off: { opacity: 0.55 },
  text: { ...v2Text.bodyBold, color: v2Colors.onPrimary },
  textSecondary: { color: v2Colors.primary },
});

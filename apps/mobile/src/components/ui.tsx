import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, MIN_TARGET, radius, shadow, spacing, typography } from '@/theme/tokens';

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const body = scroll ? (
    <ScrollView contentContainerStyle={styles.screenContent} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  ) : (
    <View style={styles.screenContent}>{children}</View>
  );
  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {body}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return (
    <Text accessibilityRole="header" style={[typography.title, styles.title]}>
      {children}
    </Text>
  );
}

export function Subtitle({ children }: { children: ReactNode }) {
  return <Text style={[typography.secondary, styles.subtitle]}>{children}</Text>;
}

export function ErrorText({ children }: { children?: string | null }) {
  if (!children) return null;
  return (
    <Text accessibilityRole="alert" style={styles.error}>
      {children}
    </Text>
  );
}

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
};

export function Button({ label, onPress, variant = 'primary', disabled = false, loading = false }: ButtonProps) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && styles.buttonPrimary,
        variant === 'secondary' && styles.buttonSecondary,
        inactive && styles.buttonDisabled,
        pressed && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#fff' : colors.primary} />
      ) : (
        <Text style={[styles.buttonLabel, variant !== 'primary' && styles.buttonLabelAlt]}>{label}</Text>
      )}
    </Pressable>
  );
}

type FieldProps = TextInputProps & { label: string; error?: string | null };

export function Field({ label, error, ...props }: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={typography.secondary}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.textSecondary}
        style={[styles.input, error ? styles.inputError : null]}
        {...props}
      />
      <ErrorText>{error}</ErrorText>
    </View>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.background },
  screenContent: { padding: spacing.md, gap: spacing.md, flexGrow: 1 },
  title: { color: colors.text },
  subtitle: { marginTop: -spacing.sm },
  error: { color: colors.danger, fontSize: 13 },
  button: {
    minHeight: MIN_TARGET + 4,
    borderRadius: radius.card,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonSecondary: { backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.primary },
  buttonDisabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
  buttonLabel: { color: '#fff', fontSize: 16, fontWeight: '600' },
  buttonLabelAlt: { color: colors.primary },
  field: { gap: spacing.xs },
  input: {
    minHeight: MIN_TARGET + 4,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DDE5F0',
    paddingHorizontal: spacing.md,
    fontSize: 16,
    color: colors.text,
  },
  inputError: { borderColor: colors.danger },
  card: { backgroundColor: colors.card, borderRadius: radius.card, padding: spacing.md, gap: spacing.sm, ...shadow },
});

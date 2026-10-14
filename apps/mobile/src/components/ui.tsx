import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
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
import i18n from '@/i18n';
import { Backdrop } from '@/components/Backdrop';
import { SectionMark } from '@/components/decor/Decor';
import { Gradient } from '@/components/Gradient';
import { RoundButton } from '@/components/RoundButton';
import { bottomPaddingFor, useTabInset } from '@/components/TabInset';
import { colors, glass, decor, MIN_TARGET, radius, shadow, shadowInset, shadowSmall, spacing, typography, line } from '@/theme/tokens';

/** Largeur max. du contenu (conteneur centré sur grand écran). `wide` : écrans à colonnes (file « Cần duyệt »). */
const CONTENT_MAX_WIDTH = 760;
const CONTENT_MAX_WIDTH_WIDE = 1100;

/** Style de conteneur centré à largeur limitée (écrans qui gèrent eux-mêmes leur ScrollView). */
export const centeredContent = { width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' } as const;

export function Screen({ children, scroll = true, wide = false }: { children: ReactNode; scroll?: boolean; wide?: boolean }) {
  const centered = { width: '100%', maxWidth: wide ? CONTENT_MAX_WIDTH_WIDE : CONTENT_MAX_WIDTH, alignSelf: 'center' } as const;
  const tabInset = useTabInset();
  const body = scroll ? (
    <ScrollView role="main" contentContainerStyle={[styles.screenContent, centered, { paddingBottom: bottomPaddingFor(tabInset, spacing.md) }]} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.screenContent, centered]}>{children}</View>
  );
  return (
    <SafeAreaView style={styles.screen}>
      <Backdrop />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {body}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type HeaderProps = { title: string; right?: ReactNode; onBack?: () => void; hideBack?: boolean; /** Titre long (ex. nom d'une tâche) : à la ligne plutôt que tronqué. */ multiline?: boolean };

/** En-tête des maquettes : flèche retour + titre (22 semibold), élément optionnel à droite. */
export function ScreenHeader({ title, right, onBack, hideBack = false, multiline = false }: HeaderProps) {
  const router = useRouter();
  const back = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/today')));
  return (
    <View style={styles.header}>
      {hideBack ? null : (
        <RoundButton label={i18n.t('common.back')} onPress={back}>
          <ChevronLeft color={colors.text} size={24} />
        </RoundButton>
      )}
      <Text accessibilityRole="header" style={[typography.title, styles.headerTitle, hideBack && styles.headerTitleFlush]} numberOfLines={multiline ? undefined : 1}>
        {title}
      </Text>
      {right}
    </View>
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
  /** Libellé lu par les lecteurs d'écran si différent du texte affiché (ex. « Duyệt » + titre de la tâche). */
  accessibilityLabel?: string;
};

export function Button({ label, onPress, variant = 'primary', disabled = false, loading = false, accessibilityLabel }: ButtonProps) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      aria-busy={loading}
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
        <ActivityIndicator color={variant === 'primary' ? colors.onPrimary : colors.accent} />
      ) : (
        <Text style={[styles.buttonLabel, variant !== 'primary' && styles.buttonLabelAlt]}>{label}</Text>
      )}
    </Pressable>
  );
}

type FieldProps = TextInputProps & { label: string; error?: string | null };

export function Field({ label, error, style, ...props }: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.placeholder}
        style={[styles.input, error ? styles.inputError : null, style]}
        {...props}
      />
      <ErrorText>{error}</ErrorText>
    </View>
  );
}

export function Card({ children, fill = false }: { children: ReactNode; /** Occupe toute la hauteur de la colonne (deux cartes côte à côte de même hauteur). */ fill?: boolean }) {
  return <View style={[styles.card, fill && styles.flex]}>{children}</View>;
}

/** Titre de section (« Top Genres », « Recently Played » de la maquette). */
export function SectionTitle({ children }: { children: ReactNode }) {
  const title = (
    <Text accessibilityRole="header" style={styles.sectionTitle}>
      {children}
    </Text>
  );
  if (decor === 'none') return title;
  return (
    <View style={styles.sectionRow}>
      <SectionMark size={24} />
      {title}
    </View>
  );
}

/** Panneau marine (bannière d'accueil de la maquette : fond ardoise, texte clair). Les enfants doivent utiliser `colors.onNavy`. */
export function NavyPanel({ children }: { children: ReactNode }) {
  return (
    <View style={styles.navy}>
      <Gradient from={colors.navyLight} to={colors.navyDeep} direction="d" />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: MIN_TARGET },
  headerTitle: { flex: 1, color: colors.text },
  headerTitleFlush: { marginLeft: 4 },
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.background },
  screenContent: { padding: spacing.md, gap: spacing.md, flexGrow: 1 },
  title: { color: colors.text },
  subtitle: { marginTop: -spacing.sm },
  error: { color: colors.danger, fontSize: 13 },
  button: {
    minHeight: MIN_TARGET + 8,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  buttonPrimary: { backgroundColor: colors.primary, borderWidth: line.width, borderColor: colors.ring, ...shadowSmall },
  buttonSecondary: { backgroundColor: colors.cardStrong, borderWidth: line.width, borderColor: colors.glassBorder, ...shadowSmall },
  buttonDisabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
  buttonLabel: { color: colors.onPrimary, fontSize: 16, fontWeight: '600' },
  buttonLabelAlt: { color: colors.accent },
  field: { gap: spacing.xs },
  fieldLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
  input: {
    minHeight: MIN_TARGET + 4,
    backgroundColor: colors.inputBg,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.glassBorderSoft,
    ...shadowInset,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    color: colors.text,
  },
  inputError: { borderColor: colors.danger },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  navy: { borderRadius: radius.card, padding: spacing.md, gap: spacing.sm, overflow: 'hidden', borderWidth: line.width, borderColor: colors.navyBorder, ...shadow },
  card: { ...glass, borderRadius: radius.card, padding: spacing.md, gap: spacing.sm },
});

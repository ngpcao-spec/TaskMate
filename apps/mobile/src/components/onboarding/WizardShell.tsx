import { ChevronLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { RoundButton } from '@/components/RoundButton';
import { Button, Screen } from '@/components/ui';
import { colors, MIN_TARGET, radius, spacing, typography } from '@/theme/tokens';

type Props = {
  number: number;
  total: number;
  title: string;
  subtitle?: string;
  children: ReactNode;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  nextLoading?: boolean;
  /** Absent = pas de « Bỏ qua bước này » (étape enfants tant qu'aucun enfant n'est créé). */
  onSkip?: () => void;
  skipLoading?: boolean;
  onBack?: () => void;
};

/** Coque d'une étape : barre de progression en segments, « Bước n/total », retour, « Tiếp tục » et « Bỏ qua bước này ». */
export function WizardShell({ number, total, title, subtitle, children, onNext, nextLabel, nextDisabled, nextLoading, onSkip, skipLoading, onBack }: Props) {
  const { t } = useTranslation();
  const label = t('onboarding.wizard.stepOf', { n: number, total });
  return (
    <Screen>
      <View style={styles.top}>
        {onBack ? (
          <RoundButton label={t('common.back')} onPress={onBack}>
            <ChevronLeft color={colors.text} size={24} />
          </RoundButton>
        ) : (
          <View style={styles.spacer} />
        )}
        <Text style={styles.stepText}>{label}</Text>
      </View>
      <View accessible accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 0, max: total, now: number }} style={styles.bar}>
        {Array.from({ length: total }, (_, i) => (
          <View key={i} style={[styles.segment, i < number && styles.segmentOn]} />
        ))}
      </View>
      <Text accessibilityRole="header" style={styles.title}>{title}</Text>
      {subtitle ? <Text style={typography.secondary}>{subtitle}</Text> : null}
      {children}
      <Button label={nextLabel ?? t('onboarding.wizard.next')} onPress={onNext} disabled={nextDisabled} loading={nextLoading} />
      {onSkip ? <Button variant="ghost" label={t('onboarding.wizard.skip')} onPress={onSkip} loading={skipLoading} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: MIN_TARGET },
  spacer: { width: MIN_TARGET, height: MIN_TARGET },
  stepText: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },
  bar: { flexDirection: 'row', gap: 6 },
  segment: { flex: 1, height: 8, borderRadius: radius.pill, backgroundColor: colors.cardStrong },
  segmentOn: { backgroundColor: colors.primary },
  title: { ...typography.title, fontSize: 24, color: colors.text, marginTop: spacing.sm },
});

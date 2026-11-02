import { useTranslation } from 'react-i18next';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { pandaExpressionImage } from '@/components/companion/pandaImages';
import type { CelebrationAction } from '@/domain/day-sections';
import type { PandaStage, PandaVariant } from '@/domain/panda';
import { v2Card, v2Colors, v2Radius, v2Spacing, v2Text, V2_TOUCH } from '../theme';

type Props = {
  stage: PandaStage;
  variant?: PandaVariant;
  pandaName: string;
  action: CelebrationAction;
  onGo?: () => void;
  /** « Xem lại » : rouvre la liste */
  onReview: () => void;
};

/** Fin de journée (V2) : visage « fier », titre « Xong hết rồi! », puis la phrase du panda selon son stade (sans répéter le titre), lien « Xem lại », et le départ si la jauge est pleine. */
export function CelebrationCard({ stage, variant = 'boy', pandaName, action, onGo, onReview }: Props) {
  const { t } = useTranslation();
  return (
    <View style={styles.card} testID="v2-celebration" accessibilityLiveRegion="polite">
      <Image
        source={pandaExpressionImage('fier', 'small', variant)}
        style={styles.face}
        resizeMode="contain"
        accessibilityRole="image"
        accessibilityLabel={t('panda.imageLabel', { name: pandaName, mood: t('panda.mood.fier') })}
      />
      <Text accessibilityRole="header" style={styles.title}>
        {t('v2.celebration.title')}
      </Text>
      <Text style={styles.voice}>{t(`v2.celebration.s${stage}`)}</Text>
      {action?.kind === 'go' ? (
        <Pressable accessibilityRole="button" accessibilityLabel={t('adventure.go')} onPress={onGo} style={({ pressed }) => [styles.go, pressed ? styles.goPressed : null]}>
          <Text style={styles.goText}>{t('adventure.go')}</Text>
        </Pressable>
      ) : null}
      {action?.kind === 'missing' ? <Text style={styles.missing}>{t('v2.celebration.missing', { n: action.energy })}</Text> : null}
      <Pressable accessibilityRole="link" accessibilityLabel={t('v2.celebration.review')} onPress={onReview} style={styles.review}>
        <Text style={styles.reviewText}>{t('v2.celebration.review')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { ...v2Card, alignItems: 'center', gap: v2Spacing.sm, paddingVertical: v2Spacing.xl },
  face: { width: 120, height: 120 },
  title: v2Text.title,
  voice: { ...v2Text.bodyBold, textAlign: 'center' },
  go: { marginTop: v2Spacing.sm, minHeight: 52, alignSelf: 'stretch', borderRadius: v2Radius.pill, backgroundColor: v2Colors.primary, alignItems: 'center', justifyContent: 'center' },
  goPressed: { backgroundColor: v2Colors.primaryPressed },
  goText: { ...v2Text.heading, color: v2Colors.onPrimary },
  missing: { ...v2Text.bodyBold, color: v2Colors.energyText, textAlign: 'center' },
  review: { minHeight: V2_TOUCH, justifyContent: 'center', paddingHorizontal: v2Spacing.lg },
  reviewText: { ...v2Text.bodyBold, color: v2Colors.primary, textDecorationLine: 'underline' },
});

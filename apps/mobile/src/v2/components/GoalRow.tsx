import { useTranslation } from 'react-i18next';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { GoalIcon } from '@/domain/goal-icons';
import { goalIconImage } from '../images';
import { v2Colors, v2Radius, v2Spacing, v2Text, V2_TOUCH } from '../theme';
import { CheckButton } from './CheckButton';

type Props = {
  icon: GoalIcon;
  title: string;
  /** énergie de l'objectif = ses points (D-106) ; nul = pas de valeur affichée (révision de la semaine) */
  energy: number | null;
  checked: boolean;
  /** cochée par l'enfant, validation du parent attendue */
  pending?: boolean;
  /** absent : pas de bouton ✓ (ligne d'information, révision de la semaine) */
  onToggle?: () => void;
  /** appui sur la ligne (ouvrir le détail, ouvrir l'écran de révision) */
  onOpen?: () => void;
  /** texte sous le titre (heure, échéance…) */
  subtitle?: string | null;
  testID?: string;
};

/** Ligne d'objectif V2 : icône, titre, « 10 ⚡ », gros bouton ✓. */
export function GoalRow({ icon, title, energy, checked, pending = false, onToggle, onOpen, subtitle, testID }: Props) {
  const { t } = useTranslation();
  const body = (
    <>
      <Image source={goalIconImage(icon)} style={styles.icon} resizeMode="contain" accessibilityIgnoresInvertColors importantForAccessibility="no" />
      <View style={styles.texts}>
        <Text style={[styles.title, checked ? styles.titleDone : null]} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {pending ? (
          <View style={styles.pendingPill}>
            <Text style={styles.pendingText}>{t('v2.goal.pending')}</Text>
          </View>
        ) : null}
      </View>
      {energy !== null ? (
        <Text style={styles.energy} accessibilityLabel={t('v2.goal.energyLabel', { points: energy })}>
          {t('v2.goal.energy', { points: energy })}
        </Text>
      ) : null}
    </>
  );
  return (
    <View testID={testID} style={styles.row}>
      {onOpen ? (
        <Pressable accessibilityRole="button" accessibilityLabel={t('v2.goal.open', { title })} onPress={onOpen} style={styles.main}>
          {body}
        </Pressable>
      ) : (
        <View style={styles.main}>{body}</View>
      )}
      {onToggle ? <CheckButton checked={checked} label={title} onPress={onToggle} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: v2Spacing.md, minHeight: 64, paddingVertical: v2Spacing.xs },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: v2Spacing.md, minHeight: V2_TOUCH },
  icon: { width: 48, height: 48 },
  texts: { flex: 1, gap: 2 },
  title: v2Text.bodyBold,
  titleDone: { color: v2Colors.textSecondary },
  subtitle: v2Text.caption,
  pendingPill: { alignSelf: 'flex-start', backgroundColor: v2Colors.pendingSoft, borderRadius: v2Radius.pill, paddingHorizontal: 8, paddingVertical: 2, marginTop: 2 },
  pendingText: { ...v2Text.caption, color: v2Colors.pending },
  energy: { ...v2Text.bodyBold, color: v2Colors.energyText },
});

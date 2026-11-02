import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { v2Colors, v2Radius, v2Shadow, v2Spacing, v2Text } from '../theme';

/** Pastille « Còn N việc hôm nay! », puis « Hôm nay: n/n việc ✓ » quand tout est coché (sans répéter le titre de la carte de fin) ; rien sans tâche prévue. */
export function DayPill({ remaining, total }: { remaining: number; total: number }) {
  const { t } = useTranslation();
  if (total <= 0) return null;
  return (
    <View style={styles.pill} accessibilityRole="text">
      <Text style={styles.text}>{remaining > 0 ? t('v2.dayPill.remaining', { count: remaining }) : t('v2.dayPill.done', { count: total })}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { alignSelf: 'center', backgroundColor: v2Colors.card, borderRadius: v2Radius.pill, paddingHorizontal: v2Spacing.lg, paddingVertical: v2Spacing.sm, ...v2Shadow },
  text: v2Text.bodyBold,
});

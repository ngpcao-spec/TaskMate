import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { formatShortDate } from '@/domain/calendar';
import { todayInTz } from '@/domain/family-time';
import { lastChange, type HistoryPoint } from '@/domain/quiz';
import { colors, typography } from '@/theme/tokens';

/**
 * Progression d'UN enfant dans le temps (résultats validés, anciens d'abord). Jamais de comparaison ni de classement entre enfants :
 * l'écran ne reçoit que les points d'un seul enfant.
 */
export function ScoreHistory({ points, timezone }: { points: HistoryPoint[]; timezone: string }) {
  const { t } = useTranslation();
  if (points.length === 0) return null;
  const change = lastChange(points);
  return (
    <View accessibilityLabel={t('revisions.progress')} style={styles.wrap}>
      <Text accessibilityRole="header" style={styles.title}>{t('revisions.progress')}</Text>
      {points.map((p) => {
        const day = formatShortDate(todayInTz(new Date(p.at), timezone));
        const text = `${day}, ${t(`revisions.kind.${p.kind}`)}, ${t('revisions.score', { score: p.score, total: p.total })}`;
        return (
          <View key={p.id} accessible accessibilityLabel={text} style={styles.row}>
            <Text style={styles.date}>{day}</Text>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${p.percent}%`, backgroundColor: p.kind === 'evaluation' ? colors.primary : colors.mint }]} />
            </View>
            <Text style={styles.score}>{t('revisions.score', { score: p.score, total: p.total })}</Text>
          </View>
        );
      })}
      {change !== null ? <Text style={typography.secondary}>{t('revisions.lastChange', { delta: change > 0 ? `+${change}` : String(change) })}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 28 },
  date: { width: 84, fontSize: 13, color: colors.textSecondary },
  track: { flex: 1, height: 8, borderRadius: 4, backgroundColor: '#E4ECF7', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  score: { width: 52, textAlign: 'right', fontSize: 13, fontWeight: '600', color: colors.text },
});

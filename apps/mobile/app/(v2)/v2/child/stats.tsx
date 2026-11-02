import { Flame } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { addDays } from '@/domain/adventure';
import { todayInTz } from '@/domain/family-time';
import { completionBuckets, computeStats, dayStreak, periodRange } from '@/domain/stats';
import { useDisplayedChild } from '@/hooks/useDisplayedChild';
import { useNow } from '@/hooks/useNow';
import { useTasks } from '@/hooks/useTasks';
import { V2Screen } from '@/v2/components/V2Screen';
import { v2Card, v2Colors, v2Font, v2Spacing, v2Text } from '@/v2/theme';

/** Jours lus pour la série (au-delà, la série affichée s'arrête là). */
const STREAK_WINDOW_DAYS = 60;
const BAR_HEIGHT = 96;

/** Thống kê (enfant, V2) : MA semaine (barres par jour) et MA série de jours. Calculs de `domain/stats`. Jamais de comparaison avec un frère ou une sœur. */
export default function V2ChildStats() {
  const { t, i18n } = useTranslation();
  const d = useDisplayedChild();
  const now = useNow();
  const tz = d?.me.family.timezone ?? 'Asia/Ho_Chi_Minh';
  const today = todayInTz(now, tz);
  const week = periodRange('week', today);
  const from = addDays(today, -STREAK_WINDOW_DAYS) < week.from ? addDays(today, -STREAK_WINDOW_DAYS) : week.from;
  const tasks = useTasks(d?.child?.id ?? null, from, week.to).data ?? [];
  const stats = computeStats(tasks, week.from, week.to);
  const bars = completionBuckets(tasks, 'week', week.from, week.to);
  const streak = dayStreak(tasks, today);
  const dayName = (day: string) => {
    const [y, m, dd] = day.split('-').map(Number) as [number, number, number];
    return new Date(Date.UTC(y, m - 1, dd, 12)).toLocaleDateString(i18n.language, { weekday: 'short', timeZone: 'UTC' });
  };

  return (
    <V2Screen title={t('v2.tabs.stats')} testID="v2-stats">
      <View style={[v2Card, styles.streak]} accessible accessibilityLabel={t('v2.stats.streakLabel', { count: streak })}>
        <Flame size={36} color={v2Colors.energy} fill={v2Colors.energySoft} />
        <View style={styles.flex}>
          <Text style={styles.big}>{streak}</Text>
          <Text style={v2Text.bodyBold}>{t('v2.stats.streak')}</Text>
        </View>
      </View>
      <View style={[v2Card, styles.week]}>
        <Text accessibilityRole="header" style={v2Text.heading}>
          {t('v2.stats.week')}
        </Text>
        <Text style={v2Text.body}>{t('v2.stats.weekDone', { done: stats.done, total: stats.total })}</Text>
        <View style={styles.bars}>
          {bars.map((b) => {
            const ratio = b.total > 0 ? b.done / b.total : 0;
            return (
              <View key={b.from} style={styles.barCol} accessible accessibilityLabel={t('v2.stats.dayLabel', { day: dayName(b.from), done: b.done, total: b.total })}>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { height: Math.round(ratio * BAR_HEIGHT) }, b.from === today ? styles.today : null]} />
                </View>
                <Text style={styles.barText}>{dayName(b.from)}</Text>
              </View>
            );
          })}
        </View>
      </View>
    </V2Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  streak: { flexDirection: 'row', alignItems: 'center', gap: v2Spacing.lg },
  big: { ...v2Text.title, fontSize: 34 },
  week: { gap: v2Spacing.sm },
  bars: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: v2Spacing.sm },
  barCol: { flex: 1, alignItems: 'center', gap: 4 },
  barTrack: { width: 22, height: BAR_HEIGHT, borderRadius: 11, backgroundColor: v2Colors.track, justifyContent: 'flex-end', overflow: 'hidden' },
  barFill: { width: '100%', borderRadius: 11, backgroundColor: v2Colors.primary },
  today: { backgroundColor: v2Colors.energy },
  barText: { ...v2Font(700, 11), color: v2Colors.textSecondary },
});

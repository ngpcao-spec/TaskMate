import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Trophy } from 'lucide-react-native';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CategoryIcon } from '@/components/CategoryIcon';
import { ProgressRing } from '@/components/ProgressRing';
import { Card, Screen, ScreenHeader } from '@/components/ui';
import { todayInTz } from '@/domain/family-time';
import { computeStats, encouragementFor, formatRate, periodRange, type StatsPeriod } from '@/domain/stats';
import { useDisplayedChild } from '@/hooks/useDisplayedChild';
import { useTasks } from '@/hooks/useTasks';
import { CATEGORY_COLORS } from '@/theme/categories';
import { colors, MIN_TARGET, typography } from '@/theme/tokens';

/**
 * Thống kê (SPEC §3.8, §5.4) : un seul profil à la fois — jamais les deux enfants côte à côte, ni classement.
 * Calcul 100 % local (domain/stats) sur les tâches en cache → fonctionne hors ligne.
 */
export default function StatsScreen() {
  const { t } = useTranslation();
  const d = useDisplayedChild();
  const [period, setPeriod] = useState<StatsPeriod>('week');
  const today = d ? todayInTz(new Date(), d.me.family.timezone) : '1970-01-01';
  const { from, to } = periodRange(period, today);
  const tasks = useTasks(d?.child?.id ?? null, from, to);

  if (!d || !d.child) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  const stats = computeStats(tasks.data ?? [], from, to);
  const message = encouragementFor(stats.rate);

  return (
    <Screen>
      <ScreenHeader title={t('stats.title')} />
      {d.viewer.role === 'parent' ? <Text style={typography.secondary}>{d.child.name}</Text> : null}

      <View style={styles.segment} accessibilityRole="tablist">
        {(['week', 'month'] as const).map((p) => (
          <Pressable key={p} accessibilityRole="radio" accessibilityLabel={t(`stats.${p}`)} accessibilityState={{ selected: period === p, checked: period === p }} aria-checked={period === p} onPress={() => setPeriod(p)} style={[styles.segmentItem, period === p && styles.segmentActive]}>
            <Text style={[styles.segmentText, period === p && styles.segmentTextActive]}>{t(`stats.${p}`)}</Text>
          </Pressable>
        ))}
      </View>

      <Card>
        <View style={styles.ringRow}>
          <ProgressRing
            size={132}
            stroke={14}
            color={colors.mint}
            ratio={(stats.rate ?? 0) / 100}
            label={formatRate(stats.rate)}
            sublabel={t('stats.doneShort')}
            accessibilityLabel={`${t('stats.completionRate')}: ${formatRate(stats.rate)}`}
          />
          <View style={styles.legend}>
            <LegendRow color={colors.primary} label={t('stats.done')} value={stats.done} />
            <LegendRow color={colors.danger} label={t('stats.notDone')} value={stats.notDone} />
            <LegendRow color={colors.mint} label={t('stats.total')} value={stats.total} />
          </View>
        </View>
      </Card>

      <Text accessibilityRole="header" style={styles.sectionTitle}>
        {t('stats.byCategory')}
      </Text>
      <Card>
        {stats.byCategory.map((c) => (
          <View key={c.category} accessible accessibilityRole="progressbar" accessibilityLabel={`${t(`category.${c.category}`)}: ${c.percent}%`} style={styles.barRow}>
            <CategoryIcon category={c.category} size={18} />
            <Text style={styles.barLabel}>{t(`category.${c.category}`)}</Text>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${c.percent}%`, backgroundColor: CATEGORY_COLORS[c.category] }]} />
            </View>
            <Text style={styles.barValue}>{c.percent}%</Text>
          </View>
        ))}
      </Card>

      {message ? (
        <View accessible accessibilityLabel={t(`stats.message.${message}`)} style={styles.encourage}>
          <Trophy color={colors.warning} size={30} />
          <View style={styles.flex}>
            <Text style={styles.encourageTitle}>{t(`stats.message.${message}`).split(/(?<=!)\s+/)[0]}</Text>
            {t(`stats.message.${message}`).split(/(?<=!)\s+/)[1] ? <Text style={typography.secondary}>{t(`stats.message.${message}`).split(/(?<=!)\s+/).slice(1).join(' ')}</Text> : null}
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

function LegendRow({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <View accessible accessibilityLabel={`${label}: ${value}`} style={styles.legendRow}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[typography.body, styles.flex, { color: colors.text, fontSize: 14 }]}>{label}</Text>
      <Text style={styles.legendValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  segment: { flexDirection: 'row', backgroundColor: colors.primaryTint, borderRadius: 999, padding: 4 },
  segmentItem: { flex: 1, minHeight: MIN_TARGET, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: colors.primary },
  segmentText: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
  segmentTextActive: { color: '#fff' },
  ringRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  legend: { flex: 1, gap: 12 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendValue: { fontSize: 15, fontWeight: '700', color: colors.text },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 36 },
  barLabel: { width: 70, fontSize: 13, color: colors.text },
  track: { flex: 1, height: 8, borderRadius: 4, backgroundColor: '#E4ECF7', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  barValue: { width: 40, textAlign: 'right', fontSize: 13, color: colors.textSecondary },
  encourage: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.primaryTint, borderRadius: 16, padding: 16 },
  encourageTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  banner: { backgroundColor: colors.primaryTint, borderRadius: 16, padding: 12 },
  bannerText: { color: colors.primary, fontSize: 14, fontWeight: '600' },
});
